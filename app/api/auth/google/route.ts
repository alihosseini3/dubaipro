import { NextResponse } from 'next/server';

/**
 * Placeholder for Google OAuth.
 *
 * Full implementation will:
 *  - Redirect the browser to Google's OAuth 2.0 consent URL with
 *    GOOGLE_CLIENT_ID, redirect_uri, state, nonce, scope=openid email profile
 *  - Handle the callback on /api/auth/google/callback, exchange the code
 *    for tokens, verify the id_token JWT, upsert the User and create a
 *    session via `createSession()` — same cookie format as email/password.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'not_implemented',
      message: 'Google login is not configured yet.'
    },
    { status: 501 }
  );
}
