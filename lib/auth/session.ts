import { cookies } from 'next/headers';
import { cache } from 'react';
import type { UserRole } from '@prisma/client';

import { AUTH_COOKIE_NAME } from './cookies';
import { prisma } from '@/lib/prisma';
import { signJwt, verifyJwt, type JwtPayload, type SignablePayload } from './jwt';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/**
 * Build the cookie attributes used throughout the app. Kept in one place
 * so every mutation (login, logout, refresh) uses identical options —
 * mismatched attributes are a common source of "session not persisting".
 */
function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

export async function createSession(user: SessionUser): Promise<string> {
  const payload: SignablePayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };
  const token = await signJwt(payload, AUTH_COOKIE_MAX_AGE);

  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, buildCookieOptions(AUTH_COOKIE_MAX_AGE));

  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, '', buildCookieOptions(0));
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function readSessionPayload(): Promise<JwtPayload | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return verifyJwt(token);
}

/**
 * Returns the currently authenticated user or null. Performs a fresh
 * database lookup so that role changes or deletions take effect on the
 * next request without waiting for the JWT to expire.
 *
 * Wrapped in `react.cache()` so the layered header (TopBar +
 * MainHeader + NavBar) and any pages that also call this within the
 * same request only hit the DB once.
 */
export const getCurrentUser = cache(
  async (): Promise<SessionUser | null> => {
    const payload = await readSessionPayload();
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true }
    });

    return user ?? null;
  }
);
