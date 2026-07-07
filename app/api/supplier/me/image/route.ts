/**
 * POST   /api/supplier/me/image?target=logo|banner
 * DELETE /api/supplier/me/image?target=logo|banner
 *
 * Supplier-scoped image upload for storefront branding (logo + banner).
 * Images run through the same Sharp pipeline as the admin uploader and the
 * resulting URL is written straight onto `Supplier.logoUrl` / `bannerUrl`.
 *
 * Only the authenticated supplier's own row can be mutated.
 */
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { handlePrismaError } from '@/lib/api/errors';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  UPLOAD_PUBLIC_DIR,
  buildSafeFilename,
} from '@/lib/upload/config';
import {
  processImage,
  extForFormat,
  mimeForFormat,
} from '@/lib/upload/process-image';

export const runtime = 'nodejs';

type Target = 'logo' | 'banner';

function parseTarget(request: Request): Target | null {
  const v = new URL(request.url).searchParams.get('target');
  return v === 'logo' || v === 'banner' ? v : null;
}

export async function POST(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const target = parseTarget(request);
  if (!target) {
    return NextResponse.json({ error: 'target must be logo or banner' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'file too large', maxBytes: MAX_IMAGE_BYTES },
      { status: 413 }
    );
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'unsupported file type', allowed: ALLOWED_IMAGE_TYPES },
      { status: 415 }
    );
  }

  // Banners are wide hero images; logos are small squares. Tune the
  // longest-edge cap accordingly so storage stays lean.
  const maxDimension = target === 'banner' ? 1920 : 600;

  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
  }

  let processed;
  try {
    processed = await processImage(inputBuffer, {
      format: 'webp',
      quality: 82,
      maxDimension,
      stripMeta: true,
    });
  } catch (err) {
    console.error('Sharp processing failed:', err);
    return NextResponse.json({ error: 'image processing failed' }, { status: 500 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const baseName = (file.name || target).replace(/\.[^.]+$/, '');
  let filename = buildSafeFilename(
    `${target}-${baseName}`,
    mimeForFormat('webp') as Parameters<typeof buildSafeFilename>[1]
  );
  filename = filename.replace(/\.[^.]+$/, `.${extForFormat('webp')}`);

  try {
    await writeFile(path.join(uploadDir, filename), processed.buffer);
  } catch (err) {
    console.error('POST /api/supplier/me/image write failed:', err);
    return NextResponse.json({ error: 'failed to persist file' }, { status: 500 });
  }

  const url = `${UPLOAD_PUBLIC_DIR}/${filename}`;

  try {
    await prisma.supplier.update({
      where: { id: ctx.supplier.id },
      data: target === 'logo' ? { logoUrl: url } : { bannerUrl: url },
    });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/supplier/me/image');
  }

  return NextResponse.json({ data: { target, url } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const target = parseTarget(request);
  if (!target) {
    return NextResponse.json({ error: 'target must be logo or banner' }, { status: 400 });
  }

  try {
    await prisma.supplier.update({
      where: { id: ctx.supplier.id },
      data: target === 'logo' ? { logoUrl: null } : { bannerUrl: null },
    });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/supplier/me/image');
  }

  return NextResponse.json({ data: { target, url: null } });
}
