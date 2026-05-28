import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_PUBLIC_DIR,
  buildSafeFilename,
  isAllowedMimeType,
  isVideoMimeType,
  maxBytesFor,
} from '@/lib/upload/config';
import {
  processImage,
  generateThumbnail,
  extForFormat,
  mimeForFormat,
  isValidOutputFormat,
  type OutputFormat,
} from '@/lib/upload/process-image';

export const runtime = 'nodejs';

/**
 * POST /api/upload
 *
 * FormData fields:
 *   file     — the file (required)
 *   folder   — destination folder (default: general)
 *   format   — output format for images: webp | jpeg | png | avif  (default: webp)
 *   quality  — quality preset: high | medium | low                  (default: medium)
 *
 * Images are processed through Sharp (resize + compress + convert).
 * Videos are stored as-is (no processing).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'invalid form data' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (file.size === 0)         return NextResponse.json({ error: 'empty file' }, { status: 400 });

  const maxBytes = maxBytesFor(file.type);
  if (file.size > maxBytes) {
    return NextResponse.json({ error: 'file too large', maxBytes }, { status: 413 });
  }

  const incomingMime = file.type;
  if (!isAllowedMimeType(incomingMime)) {
    return NextResponse.json({ error: 'unsupported file type', allowed: ALLOWED_MIME_TYPES }, { status: 415 });
  }

  const folder        = (form.get('folder')        as string | null) || 'general';
  const fmtRaw        = (form.get('format')        as string | null) ?? 'webp';
  const qualityRaw    = (form.get('quality')       as string | null) ?? '80';
  const maxDimRaw     = (form.get('maxDimension')  as string | null) ?? '1920';
  const stripMetaRaw  = (form.get('stripMeta')     as string | null) ?? 'true';
  const thumbSizeRaw  = (form.get('thumbnailSize') as string | null) ?? '400';
  const altText       = (form.get('alt')           as string | null) || undefined;
  const titleText     = (form.get('title')         as string | null) || undefined;
  const captionText   = (form.get('caption')       as string | null) || undefined;

  const thumbnailSize = Math.max(100, Math.min(1200, parseInt(thumbSizeRaw, 10) || 400));

  const outputFormat: OutputFormat = isValidOutputFormat(fmtRaw) ? fmtRaw : 'webp';
  const quality      = Math.max(30, Math.min(100, parseInt(qualityRaw, 10)  || 80));
  const maxDimension = Math.max(0,              parseInt(maxDimRaw,  10)   || 1920);
  const stripMeta    = stripMetaRaw !== 'false';

  const isVideo = isVideoMimeType(incomingMime);

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  let finalBuffer: Buffer;
  let finalMime: string;
  let finalFilename: string;
  let width: number | undefined;
  let height: number | undefined;
  let originalSize: number;
  let savedPct: number;
  let thumbUrl: string | undefined;

  if (isVideo) {
    /* ── Video: store as-is ────────────────────────────────────────────── */
    finalBuffer  = Buffer.from(await file.arrayBuffer());
    finalMime    = incomingMime;
    finalFilename = buildSafeFilename(file.name || 'video', incomingMime);
    originalSize = file.size;
    savedPct     = 0;
  } else {
    /* ── Image: Sharp pipeline ─────────────────────────────────────────── */
    let inputBuffer: Buffer;
    try {
      inputBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
    }

    let processed;
    try {
      processed = await processImage(inputBuffer, { format: outputFormat, quality, maxDimension, stripMeta });
    } catch (err) {
      console.error('Sharp processing failed:', err);
      return NextResponse.json({ error: 'image processing failed' }, { status: 500 });
    }

    finalBuffer   = processed.buffer;
    finalMime     = processed.mimeType;
    width         = processed.width;
    height        = processed.height;
    originalSize  = processed.originalSize;
    savedPct      = processed.savingsPct;

    // Use processed extension (not incoming)
    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    finalFilename = buildSafeFilename(
      baseName,
      // cast: mimeForFormat returns a valid AllowedMimeType
      mimeForFormat(outputFormat) as Parameters<typeof buildSafeFilename>[1],
    );
    // Ensure the extension matches the output format
    finalFilename = finalFilename.replace(/\.[^.]+$/, `.${extForFormat(outputFormat)}`);
  }

  try {
    await writeFile(path.join(uploadDir, finalFilename), finalBuffer);
  } catch (err) {
    console.error('POST /api/upload write failed:', err);
    return NextResponse.json({ error: 'failed to persist file' }, { status: 500 });
  }

  /* ── Thumbnail (images only) ──────────────────────────────────────────── */
  if (!isVideo) {
    try {
      const thumbBuf = await generateThumbnail(finalBuffer, thumbnailSize);
      const thumbFilename = `thumb_${finalFilename.replace(/\.[^.]+$/, '.webp')}`;
      await writeFile(path.join(uploadDir, thumbFilename), thumbBuf);
      thumbUrl = `${UPLOAD_PUBLIC_DIR}/${thumbFilename}`;
    } catch (err) {
      console.error('Thumbnail generation failed (non-fatal):', err);
    }
  }

  const url = `${UPLOAD_PUBLIC_DIR}/${finalFilename}`;

  let assetId: string | undefined;
  try {
    const created = await prisma.mediaAsset.create({
      data: {
        filename:     finalFilename,
        originalName: (file.name || 'file').slice(0, 255),
        url,
        thumbnailUrl: thumbUrl,
        mimeType:     finalMime,
        size:         finalBuffer.byteLength,
        width,
        height,
        folder,
        tags:         [],
        uploadedById: user.id,
        alt:          altText?.slice(0, 255),
        title:        titleText?.slice(0, 255),
        caption:      captionText?.slice(0, 500),
      },
    });
    assetId = created.id;
  } catch {
    // Non-fatal: file saved to disk
  }

  return NextResponse.json({
    data: {
      id:           assetId,
      url,
      thumbnailUrl: thumbUrl,
      filename:     finalFilename,
      mimeType:     finalMime,
      size:         finalBuffer.byteLength,
      width,
      height,
      originalSize,
      savingsPct:   savedPct,
    },
  }, { status: 201 });
}
