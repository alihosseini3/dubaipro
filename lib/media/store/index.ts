/**
 * Storage adapter factory.
 *
 * Reads MEDIA_STORAGE env var at startup:
 *   "local"      — default; files stored under public/uploads
 *   "s3"         — AWS S3 / MinIO (requires MEDIA_S3_* env vars)
 *   "r2"         — Cloudflare R2 (uses S3-compatible adapter)
 *
 * Import `storageAdapter` everywhere in the pipeline instead of calling
 * fs-store directly. This is the ONLY file that needs to change when
 * switching providers.
 */
import type { StorageAdapter } from './types';
import { fsAdapter } from './fs-store';

function buildAdapter(): StorageAdapter {
  const provider = process.env.MEDIA_STORAGE ?? 'local';
  switch (provider) {
    case 's3':
    case 'r2':
      // Dynamically load the S3 adapter only when configured — keeps
      // the AWS SDK out of the bundle for local-only deployments.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { s3Adapter } = require('./s3-store') as typeof import('./s3-store');
      return s3Adapter;
    case 'local':
    default:
      return fsAdapter;
  }
}

export const storageAdapter: StorageAdapter = buildAdapter();
export type { StorageAdapter, PutOptions, PutResult } from './types';
