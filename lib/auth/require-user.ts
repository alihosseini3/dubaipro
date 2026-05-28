import { redirect } from 'next/navigation';

import { getCurrentUser, type SessionUser } from './session';

/**
 * Server-side guard for authenticated pages (any role).
 * Redirects to /{locale}/login with a `from` param if unauthenticated.
 */
export async function requireUser(
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
  return user;
}
