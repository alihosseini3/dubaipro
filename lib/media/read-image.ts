/**
 * Reads an image from the storage layer (local fs OR remote http URL)
 * and returns it as a Buffer. Used by AI Vision routes that need the
 * raw bytes (since AI providers can't fetch from localhost).
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';

export async function readImageBuffer(url: string): Promise<Buffer | null> {
  /* Remote URL — fetch it */
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  /* Local URL (e.g. /uploads/xyz.webp) → read from public dir */
  if (url.startsWith('/')) {
    const filename = url.startsWith(`${MEDIA_PUBLIC_DIR}/`)
      ? url.slice(MEDIA_PUBLIC_DIR.length + 1)
      : url.replace(/^\//, '').replace(/^uploads\//, '');

    const filePath = path.join(process.cwd(), 'public', MEDIA_PUBLIC_DIR, filename);

    try {
      return await fs.readFile(filePath);
    } catch {
      /* Try alternative: full URL path under public/ */
      try {
        const altPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
        return await fs.readFile(altPath);
      } catch {
        return null;
      }
    }
  }

  return null;
}
