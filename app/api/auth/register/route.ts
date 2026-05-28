import { NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { dispatchAutomation } from '@/lib/automation/dispatch';
import { hashPassword, isValidPassword } from '@/lib/auth/password';
import { isPublicSignupRole } from '@/lib/auth/rbac';
import { createSession } from '@/lib/auth/session';
import { linkReferralOnSignup, REF_COOKIE } from '@/lib/referral/service';
import { getSiteUrl } from '@/lib/seo/site';

type RegisterBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public registration endpoint.
 *
 * Role assignment rules (enforced centrally via `isPublicSignupRole`):
 * - Default to `CUSTOMER` when the caller omits `role`.
 * - Accept `CUSTOMER`, `SELLER`, and `SUPPLIER` when explicitly requested.
 * - Reject `ADMIN` — privilege escalation through the public API is
 *   structurally impossible because `ADMIN` is not in the public whitelist.
 *
 * SUPPLIER accounts still need an admin-created `Supplier` profile before
 * they can publish products; the role alone only grants buyer-side access.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<RegisterBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  if (!isNonEmptyString(body.name)) errors.name = 'name is required';
  if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim())) {
    errors.email = 'valid email is required';
  }
  if (!isValidPassword(body.password)) {
    errors.password = 'password must be 8-128 characters';
  }

  let requestedRole: UserRole = UserRole.CUSTOMER;
  if (body.role !== undefined) {
    if (isPublicSignupRole(body.role)) {
      requestedRole = body.role;
    } else {
      errors.role = 'role must be CUSTOMER, SELLER, or SUPPLIER';
    }
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  const email = (body.email as string).trim().toLowerCase();
  const name = (body.name as string).trim();
  const passwordHash = await hashPassword(body.password as string);

  try {
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash, role: requestedRole },
      select: { id: true, name: true, email: true, role: true }
    });

    await createSession(user);

    // Best-effort referral attribution from the `ref` cookie set by
    // middleware. Never blocks signup on failure.
    const refCode = request.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${REF_COOKIE}=`))
      ?.split('=')[1];
    if (refCode) {
      void linkReferralOnSignup({
        newUserId: user.id,
        newUserEmail: user.email,
        code: decodeURIComponent(refCode)
      });
    }

    // Fire-and-forget marketing automation. Failures are absorbed
    // inside the dispatcher — registration must never depend on email.
    void dispatchAutomation({
      eventType: 'USER_REGISTERED',
      userId: user.id,
      dedupeKey: `USER_REGISTERED:${user.id}`,
      email: user.email,
      vars: {
        name: user.name,
        link: `${getSiteUrl()}/en/products`
      }
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
    return handlePrismaError(error, 'POST /api/auth/register');
  }
}
