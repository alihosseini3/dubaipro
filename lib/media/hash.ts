/**
 * Content-addressed hashing for duplicate detection.
 *
 * The pipeline computes a SHA-256 of the *original* upload bytes (not
 * the post-Sharp output). Two uploads of the same source — even with
 * different SEO inputs — collide on this hash, letting the API short-
 * circuit and reuse the existing `MediaAsset` row.
 */

import { createHash } from 'node:crypto';

/** Full hex SHA-256 digest. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * 10-char prefix used in filenames. Long enough to avoid collisions
 * for the size of catalog DubaiPro is targeting (millions of files
 * still have a per-file collision probability < 1e-12), short enough
 * to keep URLs tidy.
 */
export function shortHash(fullHash: string): string {
  return fullHash.slice(0, 10);
}
