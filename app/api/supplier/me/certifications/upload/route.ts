/**
 * POST /api/supplier/me/certifications/upload
 *
 * Raw file upload for a certification (PDF or image). Returns a URL only —
 * the caller then POSTs the metadata (title, type, issuer, dates) to
 * `/api/supplier/me/certifications` to persist the row. Mirrors the
 * upload-then-persist split already used by `/api/supplier/me/image`.
 */
import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { memberHasPermission } from '@/lib/auth/permissions';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  documentExtensionFor,
  isAllowedDocumentMime
} from '@/lib/supplier/registration';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UPLOAD_PUBLIC_DIR = '/uploads/supplier-certs';
const DISK_DIR = path.join(process.cwd(), 'public', 'uploads', 'supplier-certs');

export async function POST(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!memberHasPermission(ctx.member.role, 'supplier.profile.manage', ctx.member.permissions)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: 'file too large', maxBytes: MAX_DOCUMENT_BYTES },
      { status: 413 }
    );
  }
  if (!isAllowedDocumentMime(file.type)) {
    return NextResponse.json(
      { error: 'unsupported file type', allowed: ALLOWED_DOCUMENT_MIME_TYPES },
      { status: 415 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
  }

  const ext = documentExtensionFor(file.type);
  const filename = `${ctx.supplier.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    await mkdir(DISK_DIR, { recursive: true });
    await writeFile(path.join(DISK_DIR, filename), buffer);
  } catch (err) {
    console.error('POST /api/supplier/me/certifications/upload write failed:', err);
    return NextResponse.json({ error: 'failed to persist file' }, { status: 500 });
  }

  return NextResponse.json(
    { data: { url: `${UPLOAD_PUBLIC_DIR}/${filename}` } },
    { status: 201 }
  );
}
