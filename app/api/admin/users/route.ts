import { NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody, isNonEmptyString } from '@/lib/api/validation';
import { hashPassword, isValidPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ALL_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.CUSTOMER,
  UserRole.SELLER,
  UserRole.SUPPLIER
];

function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

/**
 * POST /api/admin/users
 *
 * Admin-only. Creates a new user account directly — bypasses the public
 * registration flow so admins can create accounts with any role (including
 * ADMIN) and skip the welcome-email automation.
 */
export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: Record<string, string> = {};

  if (!isNonEmptyString(body.name)) errors.name = 'name is required';

  if (!isNonEmptyString(body.email) || !EMAIL_RE.test((body.email as string).trim())) {
    errors.email = 'valid email is required';
  }

  if (!isValidPassword(body.password)) {
    errors.password = 'password must be 8–128 characters';
  }

  const role: UserRole = isValidRole(body.role) ? body.role : UserRole.CUSTOMER;

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  const email = (body.email as string).trim().toLowerCase();
  const name = (body.name as string).trim();
  const passwordHash = await hashPassword(body.password as string);

  try {
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return badRequest('An account with this email already exists', {
        email: 'already in use'
      });
    }
    return handlePrismaError(error, 'POST /api/admin/users');
  }
}
