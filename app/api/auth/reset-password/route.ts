import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { hashPassword, isValidPassword } from '@/lib/auth/password';
import { hashResetToken } from '@/lib/auth/reset-token';

type ResetBody = { token?: unknown; password?: unknown };

const INVALID_TOKEN_ERROR = 'This reset link is invalid or has expired.';

/**
 * Consume a password reset token and set a new password.
 *
 * Security:
 *  - Token is single-use: deleted inside the same transaction that
 *    updates the password.
 *  - Token is expired-checked on the server (never trust client clocks).
 *  - All other outstanding tokens for the same user are also invalidated
 *    on success — if an attacker got a parallel link, it becomes useless.
 *  - Password rules match the register endpoint (`isValidPassword`).
 *  - No user enumeration: any invalid/expired token returns the exact
 *    same generic error.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<ResetBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.token)) {
    return badRequest(INVALID_TOKEN_ERROR);
  }
  if (!isValidPassword(body.password)) {
    return badRequest('Password must be 8-128 characters.', {
      password: 'password must be 8-128 characters'
    });
  }

  const tokenHash = hashResetToken(body.token.trim());

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true }
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      // Best-effort cleanup of an expired row so it can't be retried.
      if (record) {
        await prisma.passwordResetToken
          .delete({ where: { id: record.id } })
          .catch(() => undefined);
      }
      return NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 });
    }

    const newHash = await hashPassword(body.password);

    // Atomic: update password + wipe every reset token for this user.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: newHash }
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } })
    ]);

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/auth/reset-password');
  }
}
