import { UserRole, SupplierMemberRole } from '@prisma/client';

import type { SessionUser } from './session';

/**
 * Code-defined RBAC permission matrix — the single source of truth for
 * "who may do what" across the platform.
 *
 * Edge-safe like lib/auth/rbac.ts: pure data + functions, no I/O, no Prisma
 * client engine (enum imports are plain objects). Deliberately NOT stored in
 * the database: with a fixed set of roles a reviewed, versioned matrix beats
 * runtime-composed permissions (no joins, no drift, code review on every
 * change).
 *
 * Two layers:
 *   1. Global `UserRole` → platform permissions (admin panel, buyer actions).
 *   2. `SupplierMemberRole` → what an org member may do INSIDE their org.
 *      Supplier-scoped checks always require an active SupplierMember row
 *      (resolved by lib/auth/require-supplier.ts) — role SUPPLIER alone
 *      grants nothing.
 *
 * Legacy note: SELLER is a retired role value (kept forever — PG enum values
 * are never removed). It maps to the buyer permission set.
 */

export const PERMISSIONS = [
  // Platform administration
  'users.manage',
  'suppliers.manage',
  'products.review',
  'plans.manage',
  'subscriptions.manage',
  'audit.read',
  'conversations.oversee',
  'settings.manage',
  'notifications.broadcast',
  // Supplier org (checked against SupplierMemberRole)
  'supplier.profile.manage',
  'supplier.products.write',
  'supplier.messages',
  'supplier.samples.manage',
  'supplier.analytics.read',
  'supplier.verification.manage',
  'supplier.subscription.view',
  'supplier.team.manage',
  'supplier.activity.read'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const BUYER_PERMISSIONS: readonly Permission[] = [];

/** Global role → platform permissions. */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    'users.manage',
    'suppliers.manage',
    'products.review',
    'plans.manage',
    'subscriptions.manage',
    'audit.read',
    'conversations.oversee',
    'settings.manage',
    'notifications.broadcast'
  ],
  [UserRole.ADMIN]: [
    'users.manage',
    'suppliers.manage',
    'products.review',
    'subscriptions.manage',
    'audit.read',
    'settings.manage',
    'notifications.broadcast'
  ],
  // SUPPLIER's real capabilities come from their SupplierMember role below.
  [UserRole.SUPPLIER]: [],
  [UserRole.CUSTOMER]: BUYER_PERMISSIONS,
  [UserRole.SELLER]: BUYER_PERMISSIONS
};

/** Supplier org role → org-scoped permissions. */
const MEMBER_PERMISSIONS: Record<SupplierMemberRole, readonly Permission[]> = {
  [SupplierMemberRole.OWNER]: [
    'supplier.profile.manage',
    'supplier.products.write',
    'supplier.messages',
    'supplier.samples.manage',
    'supplier.analytics.read',
    'supplier.verification.manage',
    'supplier.subscription.view',
    'supplier.team.manage',
    'supplier.activity.read'
  ],
  [SupplierMemberRole.MANAGER]: [
    'supplier.profile.manage',
    'supplier.products.write',
    'supplier.messages',
    'supplier.samples.manage',
    'supplier.analytics.read',
    'supplier.verification.manage',
    'supplier.subscription.view',
    'supplier.team.manage',
    'supplier.activity.read'
  ],
  [SupplierMemberRole.PRODUCT_EDITOR]: [
    'supplier.products.write',
    'supplier.analytics.read'
  ],
  [SupplierMemberRole.MESSAGING_AGENT]: [
    'supplier.messages',
    'supplier.samples.manage'
  ],
  [SupplierMemberRole.ANALYST]: ['supplier.analytics.read']
};

/** True when the permission string is org-scoped (member-matrix territory). */
export function isSupplierPermission(permission: Permission): boolean {
  return permission.startsWith('supplier.');
}

/** Global check: does this user's platform role grant the permission? */
export function roleHasPermission(
  subject: SessionUser | UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!subject) return false;
  const role = typeof subject === 'string' ? subject : subject.role;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Org-scoped check: does this member role (plus optional per-member override
 * strings from `SupplierMember.permissions`) grant the permission?
 */
export function memberHasPermission(
  memberRole: SupplierMemberRole,
  permission: Permission,
  overrides: readonly string[] = []
): boolean {
  return (
    MEMBER_PERMISSIONS[memberRole]?.includes(permission) ||
    overrides.includes(permission)
  );
}

/** Admin-tier check that includes SUPER_ADMIN (use instead of `role === 'ADMIN'`). */
export function isAdminRole(
  subject: SessionUser | UserRole | null | undefined
): boolean {
  if (!subject) return false;
  const role = typeof subject === 'string' ? subject : subject.role;
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}
