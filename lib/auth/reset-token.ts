import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password reset token utilities.
 *
 * - `generateResetToken` creates a cryptographically strong random token
 *   (URL-safe base64, 32 bytes / 256 bits of entropy). Only the raw token
 *   is ever emailed to the user; only its SHA-256 hash is persisted, so a
 *   DB dump cannot be used to hijack accounts.
 * - `hashResetToken` is a plain SHA-256 (no salt/KDF). Tokens are high-
 *   entropy random strings with a short lifetime — salting would prevent
 *   the lookup-by-hash pattern we rely on for O(1) validation and would
 *   add zero security over 256-bit random input.
 * - `safeEqualHex` compares two hex-encoded hashes in constant time.
 */

const TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateResetToken(): string {
  // base64url: URL-safe, no padding, ~43 chars.
  return randomBytes(TOKEN_BYTES)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
