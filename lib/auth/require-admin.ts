import { redirect } from 'next/navigation';

import { getCurrentUser, type SessionUser } from './session';
import { isAdminRole } from './permissions';

/**
 * Server-side guard used by admin layouts/pages.
 *
 * - No session            → redirect to /{locale}/login with a `from` param
 * - Non-admin             → redirect to /{locale} (home)
 * - ADMIN / SUPER_ADMIN   → returns the full user record
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
  if (!isAdminRole(user)) {
    redirect(`/${locale}`);
  }
  return user;
}

/**
 * API-route helper that returns either the authenticated admin (ADMIN or
 * SUPER_ADMIN) or null. Use inside route handlers to reply with a 401/403
 * instead of redirecting.
 */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user)) return null;
  return user;
}
