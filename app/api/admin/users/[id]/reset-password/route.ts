import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { handlePrismaError, notFound } from '@/lib/api/errors';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Generate a URL-safe temporary password.
 *
 * - 12 bytes of CSPRNG entropy → 16 chars base64url → ≥ 96 bits of entropy.
 * - Kept short enough for a human to copy/paste once, long enough to resist
 *   any realistic brute-force window before the user sets a new password.
 */
function generateTempPassword(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * POST /api/admin/users/[id]/reset-password
 *
 * Admin-only. Generates a temporary password, writes its scrypt hash to
 * the user row, and returns the **cleartext** value EXACTLY ONCE in the
 * response. The admin is expected to hand it to the user over a secure
 * channel; the password is never stored in plaintext or logged.
 *
 * Security notes:
 *   - We never echo or log the cleartext elsewhere.
 *   - Existing sessions remain valid (JWTs don't re-check the password),
 *     but the user must use the new password next time they log in.
 *     To force sign-out everywhere you'd need a `passwordChangedAt`
 *     column — tracked as future work.
 */
export async function POST(_request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const exists = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) return notFound('User not found');

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: { password: passwordHash }
    });

    return NextResponse.json({ data: { tempPassword } });
  } catch (error) {
    return handlePrismaError(error, `POST /api/admin/users/${id}/reset-password`);
  }
}
