import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { getCurrentUser } from '@/lib/auth/session';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_PUBLIC_DIR,
  buildSafeFilename,
  isAllowedMimeType
} from '@/lib/upload/config';

export const runtime = 'nodejs';

/**
 * POST /api/payment/receipt-upload
 *
 * Customer-facing receipt upload for manual transfers (CARD_TRANSFER /
 * BANK_TRANSFER). Same storage backend as `/api/upload` but accessible
 * to any authenticated user — admins still review the result through
 * `/admin/payments`, and `submitManualPayment` validates ownership of
 * the target Payment row.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'expected multipart/form-data' },
      { status: 400 }
    );
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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'file too large', maxBytes: MAX_UPLOAD_BYTES },
      { status: 413 }
    );
  }
  const mime = file.type;
  if (!isAllowedMimeType(mime)) {
    return NextResponse.json(
      { error: 'unsupported file type', allowed: ALLOWED_MIME_TYPES },
      { status: 415 }
    );
  }

  const filename = buildSafeFilename(file.name || 'receipt', mime);
  // Store receipts in their own directory so admins can audit at a glance.
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
  const fullPath = path.join(uploadDir, filename);

  try {
    await mkdir(uploadDir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, bytes);
  } catch (error) {
    console.error('POST /api/payment/receipt-upload write failed:', error);
    return NextResponse.json(
      { error: 'failed to persist file' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: {
        url: `${UPLOAD_PUBLIC_DIR}/receipts/${filename}`,
        filename,
        size: file.size,
        mimeType: mime
      }
    },
    { status: 201 }
  );
}
