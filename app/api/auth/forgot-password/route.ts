import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken
} from '@/lib/auth/reset-token';

type ForgotBody = { email?: unknown; locale?: unknown };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_OK = { data: { ok: true } };

/**
 * Request a password reset link.
 *
 * Security:
 *  - Always returns 200 with the same payload, regardless of whether the
 *    email exists — prevents account enumeration.
 *  - The emailed token is a 256-bit random string; only its SHA-256 hash
 *    is persisted.
 *  - Any previous reset tokens for the user are invalidated (deleted)
 *    when a new one is issued.
 *  - Tokens expire after 15 minutes.
 *  - Email delivery is stubbed to `console.info`; swap in a real mailer
 *    where marked.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<ForgotBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim())) {
    // Intentionally generic to avoid leaking which field failed.
    return NextResponse.json(GENERIC_OK);
  }

  const email = body.email.trim().toLowerCase();
  const locale = isNonEmptyString(body.locale) ? body.locale.trim() : 'en';
  const safeLocale = /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : 'en';

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true }
    });

    if (user) {
      const rawToken = generateResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      // Invalidate any outstanding tokens for this user, then create the
      // new one — wrapped in a transaction so we never leave the account
      // without a valid token after partial failure.
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt }
        })
      ]);

      const origin =
        request.headers.get('origin') ??
        process.env.NEXT_PUBLIC_APP_URL ??
        'http://localhost:3000';
      const resetUrl = `${origin}/${safeLocale}/reset-password?token=${rawToken}`;

      // TODO: replace with real email provider (Resend / SES / SMTP).
      console.info(
        `[forgot-password] Reset link for ${user.email}: ${resetUrl} (expires ${expiresAt.toISOString()})`
      );
    }

    // Same response whether or not the user existed.
    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    return handlePrismaError(error, 'POST /api/auth/forgot-password');
  }
}
