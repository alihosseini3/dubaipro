import { NextResponse } from 'next/server';

/**
 * Placeholder for passwordless / OTP login.
 *
 * Full implementation will:
 *  - POST /api/auth/otp            — accept { email | phone }, generate a
 *    6-digit code, store hash + expiry, dispatch via email/SMS provider
 *  - POST /api/auth/otp/verify     — accept { identifier, code }, verify
 *    against the stored hash, create a session via `createSession()`
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'not_implemented',
      message: 'OTP login is not configured yet.'
    },
    { status: 501 }
  );
}
