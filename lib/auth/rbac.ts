import { UserRole } from '@prisma/client';

import type { SessionUser } from './session';

/**
 * Thin, edge-safe RBAC utilities.
 *
 * Kept separate from `session.ts` so it can be imported from middleware,
 * server components, or API routes without pulling the Prisma client into
 * the Edge runtime. All helpers are pure functions over the role string —
 * no I/O.
 *
 * Authoritative role set (must stay in sync with `UserRole` in
 * `prisma/schema.prisma`):
 *
 * - `SUPER_ADMIN` — Platform owner tier (everything ADMIN can, plus
 *                   oversight/destructive permissions — lib/auth/permissions.ts).
 * - `ADMIN`    — Staff with full backend access.
 * - `CUSTOMER` — Default for self-registered buyers.
 * - `SELLER`   — LEGACY value (no longer offered at signup; treated as a
 *                buyer everywhere). Never removed — PG enum values are
 *                append-only.
 * - `SUPPLIER` — B2B supplier org member (owner or employee); fine-grained
 *                capabilities come from `SupplierMember.role`.
 */

export { UserRole } from '@prisma/client';

/** Roles a user may self-select during public registration. */
export const PUBLIC_SIGNUP_ROLES = [
  UserRole.CUSTOMER,
  UserRole.SUPPLIER
] as const;
export type PublicSignupRole = (typeof PUBLIC_SIGNUP_ROLES)[number];

/**
 * Type guard: narrows an arbitrary value to a role that is legal for public
 * sign-up. ADMIN can **never** be assigned through this path — admins are
 * provisioned via seed scripts or by an existing ADMIN via the user-admin UI.
 */
export function isPublicSignupRole(v: unknown): v is PublicSignupRole {
  return (
    typeof v === 'string' &&
    (PUBLIC_SIGNUP_ROLES as readonly string[]).includes(v)
  );
}

/**
 * Generic check used throughout the codebase. Accepts either a full session
 * user or a raw role string so call sites stay terse.
 */
export function hasRole(
  subject: SessionUser | UserRole | null | undefined,
  ...allowed: UserRole[]
): boolean {
  if (!subject) return false;
  const role = typeof subject === 'string' ? subject : subject.role;
  return allowed.includes(role);
}

export const isAdmin = (u: SessionUser | null | undefined): boolean =>
  hasRole(u, UserRole.ADMIN, UserRole.SUPER_ADMIN);

export const isSupplier = (u: SessionUser | null | undefined): boolean =>
  hasRole(u, UserRole.SUPPLIER);

export const isSeller = (u: SessionUser | null | undefined): boolean =>
  hasRole(u, UserRole.SELLER);
