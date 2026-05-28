import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';

import { getCurrentUser, type SessionUser } from './session';

export type SupplierContext = {
  user: SessionUser;
  supplier: {
    id: string;
    name: string;
  };
};

/**
 * API-route variant of `requireSupplier` that does NOT redirect. Returns
 * `null` when the request is unauthenticated OR has no linked supplier
 * row. Callers reply with 401/403 themselves so JSON clients receive a
 * usable error instead of an HTML redirect.
 */
export async function getSupplierContextOrNull(): Promise<SupplierContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true }
  });
  if (!supplier) return null;

  return { user, supplier };
}

/**
 * Server-side guard for the supplier dashboard.
 *
 * - No session                 → redirect to /{locale}/login
 * - Authenticated but not a linked supplier → redirect to /{locale}
 * - Linked supplier            → returns `{ user, supplier }`
 *
 * Any `Supplier` row linked to the current user grants access: we look up
 * by `userId` rather than by role alone so an admin cannot accidentally
 * access a supplier they don't own.
 */
export async function requireSupplier(
  locale: string,
  from?: string
): Promise<SupplierContext> {
  const user = await getCurrentUser();
  if (!user) {
    const target = from
      ? `/${locale}/login?from=${encodeURIComponent(from)}`
      : `/${locale}/login`;
    redirect(target);
  }

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true }
  });

  if (!supplier) {
    redirect(`/${locale}`);
  }

  return { user, supplier };
}
