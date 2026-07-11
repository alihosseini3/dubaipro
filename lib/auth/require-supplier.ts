import { redirect } from 'next/navigation';
import type { SupplierMemberRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { getCurrentUser, type SessionUser } from './session';
import { memberHasPermission, type Permission } from './permissions';

export type SupplierMemberContext = {
  id: string;
  role: SupplierMemberRole;
  permissions: string[];
};

export type SupplierContext = {
  user: SessionUser;
  supplier: {
    id: string;
    name: string;
  };
  /** The caller's team membership — drives fine-grained permission checks. */
  member: SupplierMemberContext;
};

/**
 * Resolve the caller's supplier org via their `SupplierMember` row.
 *
 * Self-heal: suppliers created before the team feature may lack a membership
 * row (e.g. a fresh environment where the owner backfill was not run). When
 * the legacy `Supplier.userId` pointer matches, we lazily create the OWNER
 * row so nobody is ever locked out of their own org.
 */
async function resolveMembership(userId: string) {
  const member = await prisma.supplierMember.findUnique({
    where: { userId },
    select: {
      id: true,
      role: true,
      permissions: true,
      isActive: true,
      supplier: { select: { id: true, name: true } }
    }
  });
  if (member) return member.isActive ? member : null;

  const ownedSupplier = await prisma.supplier.findUnique({
    where: { userId },
    select: { id: true, name: true }
  });
  if (!ownedSupplier) return null;

  const created = await prisma.supplierMember.create({
    data: { supplierId: ownedSupplier.id, userId, role: 'OWNER' },
    select: {
      id: true,
      role: true,
      permissions: true,
      isActive: true,
      supplier: { select: { id: true, name: true } }
    }
  });
  return created;
}

/**
 * API-route variant of `requireSupplier` that does NOT redirect. Returns
 * `null` when the request is unauthenticated OR the user has no active
 * membership in a supplier org. Callers reply with 401/403 themselves so
 * JSON clients receive a usable error instead of an HTML redirect.
 */
export async function getSupplierContextOrNull(): Promise<SupplierContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await resolveMembership(user.id);
  if (!member) return null;

  return {
    user,
    supplier: member.supplier,
    member: { id: member.id, role: member.role, permissions: member.permissions }
  };
}

/**
 * Server-side guard for the supplier dashboard.
 *
 * - No session                  → redirect to /{locale}/login
 * - No active org membership    → redirect to /{locale}
 * - Active member (owner or employee) → returns `{ user, supplier, member }`
 *
 * Data isolation: downstream services must take `supplier.id` from this
 * context, never from client input.
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

  const member = await resolveMembership(user.id);
  if (!member) {
    redirect(`/${locale}`);
  }

  return {
    user,
    supplier: member.supplier,
    member: { id: member.id, role: member.role, permissions: member.permissions }
  };
}

/**
 * Page-level guard for permission-gated supplier dashboard sections
 * (e.g. /supplier/team needs 'supplier.team.manage'). Redirects members
 * without the permission back to the dashboard home.
 */
export async function requireSupplierPermission(
  locale: string,
  permission: Permission,
  from?: string
): Promise<SupplierContext> {
  const context = await requireSupplier(locale, from);
  if (
    !memberHasPermission(context.member.role, permission, context.member.permissions)
  ) {
    redirect(`/${locale}/supplier`);
  }
  return context;
}
