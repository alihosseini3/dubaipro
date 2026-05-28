/**
 * Central configuration and helpers for the upload system (images + videos).
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;    // 2 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB
/** Kept for backward-compat; refers to image limit */
export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export type AllowedVideoType = (typeof ALLOWED_VIDEO_TYPES)[number];
export type AllowedMimeType = AllowedImageType | AllowedVideoType;

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export const UPLOAD_PUBLIC_DIR = '/uploads';

export type UploadResult = {
  url: string;
  filename: string;
  size: number;
  mimeType: AllowedMimeType;
};

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function isVideoMimeType(value: string): value is AllowedVideoType {
  return (ALLOWED_VIDEO_TYPES as readonly string[]).includes(value);
}

export function maxBytesFor(mime: string): number {
  return isVideoMimeType(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function extensionFor(mime: AllowedMimeType): string {
  return MIME_TO_EXT[mime];
}

/**
 * Produce a safe, collision-resistant filename.
 */
export function buildSafeFilename(original: string, mime: AllowedMimeType): string {
  const base = original
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';

  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const ext = extensionFor(mime);

  return `${base}-${stamp}-${rand}.${ext}`;
}
