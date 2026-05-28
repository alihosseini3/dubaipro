import { redirect } from 'next/navigation';

import { getCurrentUser, type SessionUser } from './session';

/**
 * Server-side guard used by admin layouts/pages.
 *
 * - No session    → redirect to /{locale}/login with a `from` param
 * - Non-admin     → redirect to /{locale} (home)
 * - ADMIN         → returns the full user record
 */
export async function requireAdmin(
  locale: string,
  from?: string
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = from
      ? `/${locale}/login?from=${encodeURIComponent(from)}`
      : `/${locale}/login`;
    redirect(target);
  }
  if (user.role !== 'ADMIN') {
    redirect(`/${locale}`);
  }
  return user;
}

/**
 * API-route helper that returns either the authenticated admin or null.
 * Use inside route handlers to reply with a 401/403 instead of redirecting.
 */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}
