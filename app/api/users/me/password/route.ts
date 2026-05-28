import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import {
  hashPassword,
  isValidPassword,
  verifyPassword
} from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

type Body = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

/**
 * POST /api/users/me/password — change own password.
 *
 * - Requires the current password (defense in depth against session hijack)
 * - Uses the same scrypt hashing as register/reset flows
 * - All other reset tokens are invalidated to kill any pending reset links
 */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.currentPassword)) {
    return badRequest('Current password required');
  }
  if (!isValidPassword(body.newPassword)) {
    return badRequest('Password must be 8-128 characters.', {
      newPassword: 'password must be 8-128 characters'
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: current.id },
      select: { id: true, password: true }
    });
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const ok = await verifyPassword(body.currentPassword, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: 'invalid_current_password' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(body.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: newHash }
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    ]);

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/users/me/password');
  }
}
