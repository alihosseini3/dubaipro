import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  badRequest,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { createSession, getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PatchBody = {
  name?: unknown;
  email?: unknown;
};

/**
 * GET /api/users/me — current user's public profile.
 */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ data: current });
}

/**
 * PATCH /api/users/me — update own name/email.
 *
 * On email change we reissue the JWT so the session stays in sync with
 * the new identity claims.
 */
export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const data: { name?: string; email?: string } = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name) || body.name.trim().length < 2) {
      errors.name = 'name is required';
    } else {
      data.name = body.name.trim();
    }
  }

  if (body.email !== undefined) {
    if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim())) {
      errors.email = 'valid email is required';
    } else {
      data.email = body.email.trim().toLowerCase();
    }
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }
  if (Object.keys(data).length === 0) {
    return badRequest('No fields to update');
  }

  try {
    const user = await prisma.user.update({
      where: { id: current.id },
      data,
      select: { id: true, name: true, email: true, role: true }
    });

    // Refresh the session cookie so `name`/`email` in the JWT reflect
    // the new state immediately.
    await createSession(user);

    return NextResponse.json({ data: user });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return badRequest('An account with this email already exists', {
        email: 'already in use'
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return notFound('User not found');
    }
    return handlePrismaError(error, 'PATCH /api/users/me');
  }
}
