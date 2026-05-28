/**
 * Local filesystem persistence for the Smart Media Engine.
 *
 * All renditions are written under `public/uploads` so Next.js serves
 * them as static files with the standard CDN-friendly cache headers.
 * The folder is created lazily; concurrent calls are safe because
 * `mkdir({ recursive: true })` is idempotent.
 *
 * The store interface is intentionally tiny so we can swap in an S3 /
 * R2 / Cloudflare-Images adapter later without touching the pipeline.
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { StorageAdapter, PutOptions, PutResult } from './types';

/** URL prefix used in DB rows and `<img src>` attributes. */
export const MEDIA_PUBLIC_DIR = '/uploads';

const DISK_DIR = path.join(process.cwd(), 'public', 'uploads');

let dirReady: Promise<void> | null = null;

async function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = mkdir(DISK_DIR, { recursive: true }).then(() => { /* void */ });
  }
  return dirReady;
}

/** Write a single rendition to disk. Returns its public URL. */
export async function putMediaFile(opts: { filename: string; buffer: Buffer }): Promise<{ filename: string; url: string; diskPath: string }> {
  await ensureDir();
  const diskPath = path.join(DISK_DIR, opts.filename);
  await writeFile(diskPath, opts.buffer);
  return {
    filename: opts.filename,
    url:      `${MEDIA_PUBLIC_DIR}/${opts.filename}`,
    diskPath,
  };
}

/**
 * Best-effort delete. Missing files are ignored.
 */
export async function deleteMediaFile(filename: string): Promise<void> {
  if (!filename) return;
  const diskPath = path.join(DISK_DIR, filename);
  await unlink(diskPath).catch(() => { /* file already gone */ });
}

/** Bulk delete — used by the API DELETE handler when wiping variants. */
export async function deleteMediaFiles(filenames: readonly string[]): Promise<void> {
  await Promise.all(filenames.map(deleteMediaFile));
}

/** StorageAdapter implementation for local filesystem. */
export const fsAdapter: StorageAdapter = {
  providerName: 'local',

  async put(opts: PutOptions): Promise<PutResult> {
    const result = await putMediaFile({ filename: opts.filename, buffer: opts.buffer });
    return { url: result.url, diskPath: result.diskPath };
  },

  async delete(filename: string): Promise<void> {
    await deleteMediaFile(filename);
  },

  async deleteMany(filenames: readonly string[]): Promise<void> {
    await deleteMediaFiles(filenames);
  },

  publicUrl(filename: string): string {
    return `${MEDIA_PUBLIC_DIR}/${filename}`;
  },
};
