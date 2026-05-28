/**
 * Minimal HS256 JWT implementation built on the Web Crypto API.
 *
 * Works identically in the Node runtime and the Edge runtime (middleware),
 * which means a single helper can sign tokens in API routes and verify
 * them inside `middleware.ts` without pulling in any third-party package.
 */

import type { UserRole } from '@prisma/client';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type JwtPayload = {
  sub: string; // user id
  email: string;
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
};

export type SignablePayload = Omit<JwtPayload, 'iat' | 'exp'>;

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Set AUTH_SECRET to a random string of 32+ characters in your environment.'
    );
  }
  return secret;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncodeBytes(encoder.encode(input));
}

function base64UrlDecodeToBytes(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  // Allocate an explicit ArrayBuffer so the returned Uint8Array is
  // compatible with Web Crypto's BufferSource parameter typing.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(
  payload: SignablePayload,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const headerB64 = base64UrlEncodeString(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  const payloadB64 = base64UrlEncodeString(JSON.stringify(full));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );
  const sigB64 = base64UrlEncodeBytes(new Uint8Array(signature));

  return `${signingInput}.${sigB64}`;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const key = await importKey();
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecodeToBytes(sigB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;

    const payload = JSON.parse(
      decoder.decode(base64UrlDecodeToBytes(payloadB64))
    ) as JwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;

    return payload;
  } catch {
    return null;
  }
}
