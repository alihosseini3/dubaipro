import { NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  badRequest,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import { parseJsonBody, isNonEmptyString } from '@/lib/api/validation';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

const ALL_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.CUSTOMER,
  UserRole.SELLER,
  UserRole.SUPPLIER
];

function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * GET /api/admin/users/[id]
 *
 * Returns the full profile + related records (addresses, orders, supplier)
 * for an admin-managed user. Passwords are never included in the payload.
 */
export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true,
            _count: { select: { items: true } }
          }
        },
        supplier: { select: { id: true, name: true, country: true, verified: true } },
        _count: { select: { orders: true, addresses: true } }
      }
    });
    if (!user) return notFound('User not found');
    return NextResponse.json({ data: user });
  } catch (error) {
    return handlePrismaError(error, `GET /api/admin/users/${id}`);
  }
}

type PatchBody = {
  name?: unknown;
  role?: unknown;
};

/**
 * PATCH /api/admin/users/[id]
 *
 * Admin-only. Updates name and/or role. Guard-rails:
 *   - Admins cannot change their OWN role (prevents accidental self-demotion
 *     lockout where the last admin downgrades themselves).
 *   - Role whitelist is validated against the Prisma enum — arbitrary
 *     strings are rejected with 400.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const data: Prisma.UserUpdateInput = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      return badRequest('name must be a non-empty string', { name: 'required' });
    }
    data.name = body.name.trim();
  }

  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return badRequest('Invalid role', {
        role: 'must be ADMIN, CUSTOMER, SELLER, or SUPPLIER'
      });
    }
    if (id === admin.id && body.role !== admin.role) {
      return NextResponse.json(
        { error: 'You cannot change your own role.' },
        { status: 403 }
      );
    }
    data.role = body.role;
  }

  if (Object.keys(data).length === 0) {
    return badRequest('No updatable fields provided');
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    return NextResponse.json({ data: user });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/admin/users/${id}`);
  }
}

/**
 * DELETE /api/admin/users/[id]
 *
 * Admin-only. Hard delete — cascades per schema (cart, addresses,
 * supplier profile). Orders have `onDelete: Restrict`, so deletion is
 * refused for users with existing orders to protect historical data.
 *
 * Self-deletion is blocked to prevent lockout.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 403 }
    );
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orders: true } } }
    });
    if (!target) return notFound('User not found');
    if (target._count.orders > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete a user with existing orders. Cancel or reassign their orders first.'
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/admin/users/${id}`);
  }
}
