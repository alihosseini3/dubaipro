import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing using Node's built-in scrypt.
 *
 * The project explicitly requires **no external auth libraries**; bcrypt is
 * therefore replaced with `scrypt` from Node's standard `crypto` module.
 * scrypt is a memory-hard KDF recommended by RFC 7914 / OWASP and provides
 * equivalent protection against brute-force and GPU attacks for this use case.
 *
 * Stored format: `scrypt$<N>$<saltHex>$<hashHex>`
 * Where N is the current algorithm version, so the format can evolve over
 * time without breaking existing credentials.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const CURRENT_VERSION = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password must be a non-empty string');
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `scrypt$${CURRENT_VERSION}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;

  const version = Number(parts[1]);
  if (!Number.isInteger(version) || version < 1 || version > CURRENT_VERSION) {
    return false;
  }

  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(password, salt, expected.length);
  if (derived.length !== expected.length) return false;

  // Constant-time comparison to prevent timing attacks.
  return timingSafeEqual(derived, expected);
}

export function isValidPassword(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 128
  );
}
