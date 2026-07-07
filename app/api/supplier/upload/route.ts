import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { handlePrismaError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  DOCUMENT_LIMITS,
  MAX_DOCUMENT_BYTES,
  MAX_VIDEO_BYTES,
  documentExtensionFor,
  isAllowedDocumentMime,
  isAllowedVideoMime,
  isDocumentType,
  isGalleryDocumentType,
  isVideoDocumentType,
} from '@/lib/supplier/registration';

export const runtime = 'nodejs';
export const maxDuration = 120;

const UPLOAD_PUBLIC_DIR = '/uploads/supplier-docs';
const DISK_DIR = path.join(process.cwd(), 'public', 'uploads', 'supplier-docs');

function buildDocFilename(supplierId: string, mime: string): string {
  const ext = documentExtensionFor(mime as Parameters<typeof documentExtensionFor>[0]);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${supplierId}-${stamp}-${rand}.${ext}`;
}

/**
 * POST /api/supplier/upload
 *
 * Supplier document upload (Step 5). FormData fields:
 *   file  (required)  pdf | jpg | jpeg | png | webp, ≤ 20 MB
 *   type  (required)  TRADE_LICENSE | PASSPORT | STORE_PHOTO | WAREHOUSE_PHOTO
 *
 * Singleton types (TRADE_LICENSE, PASSPORT, STORE_VIDEO) keep one row per
 * type — re-uploading replaces the previous file. Gallery types
 * (STORE_PHOTO, WAREHOUSE_PHOTO) append up to their per-type limit.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!supplier) {
    return NextResponse.json(
      { error: 'Complete the account step before uploading documents' },
      { status: 409 }
    );
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

  const type = form.get('type');
  if (!isDocumentType(type)) {
    return NextResponse.json({ error: 'invalid or missing document type' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }

  const isVideo = isVideoDocumentType(type);
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: 'file too large', maxBytes }, { status: 413 });
  }
  const mimeOk = isVideo ? isAllowedVideoMime(file.type) : isAllowedDocumentMime(file.type);
  if (!mimeOk) {
    return NextResponse.json(
      {
        error: 'unsupported file type',
        allowed: isVideo ? ALLOWED_VIDEO_MIME_TYPES : ALLOWED_DOCUMENT_MIME_TYPES,
      },
      { status: 415 }
    );
  }

  // Enforce the per-type upload limit for gallery types.
  if (isGalleryDocumentType(type)) {
    const existingCount = await prisma.supplierDocument.count({
      where: { supplierId: supplier.id, type },
    });
    if (existingCount >= DOCUMENT_LIMITS[type]) {
      return NextResponse.json(
        { error: `Upload limit reached (max ${DOCUMENT_LIMITS[type]})` },
        { status: 409 }
      );
    }
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
  }

  const filename = buildDocFilename(supplier.id, file.type);
  try {
    await mkdir(DISK_DIR, { recursive: true });
    await writeFile(path.join(DISK_DIR, filename), buffer);
  } catch (err) {
    console.error('POST /api/supplier/upload write failed:', err);
    return NextResponse.json({ error: 'failed to persist file' }, { status: 500 });
  }

  const fileUrl = `${UPLOAD_PUBLIC_DIR}/${filename}`;

  try {
    // Singleton types replace any prior upload; gallery types append.
    if (!isGalleryDocumentType(type)) {
      await prisma.supplierDocument.deleteMany({
        where: { supplierId: supplier.id, type },
      });
    }
    const doc = await prisma.supplierDocument.create({
      data: { supplierId: supplier.id, type, fileUrl },
      select: { id: true, type: true, fileUrl: true, createdAt: true },
    });
    return NextResponse.json(
      {
        data: {
          id: doc.id,
          type: doc.type,
          fileUrl: doc.fileUrl,
          createdAt: doc.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handlePrismaError(error, 'POST /api/supplier/upload');
  }
}

/**
 * DELETE /api/supplier/upload?id=<documentId>
 *
 * Removes a single uploaded document owned by the current supplier (used to
 * remove a photo/video from a gallery). The on-disk file is best-effort
 * unlinked; the DB row is the source of truth.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!supplier) {
    return NextResponse.json({ error: 'supplier not found' }, { status: 409 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing document id' }, { status: 400 });
  }

  try {
    const doc = await prisma.supplierDocument.findFirst({
      where: { id, supplierId: supplier.id },
      select: { id: true, fileUrl: true },
    });
    if (!doc) {
      return NextResponse.json({ error: 'document not found' }, { status: 404 });
    }

    await prisma.supplierDocument.delete({ where: { id: doc.id } });

    // Best-effort disk cleanup (ignore failures — row removal is canonical).
    const filename = doc.fileUrl.split('/').pop();
    if (filename) {
      await unlink(path.join(DISK_DIR, filename)).catch(() => undefined);
    }

    return NextResponse.json({ data: { id: doc.id } });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/supplier/upload');
  }
}
