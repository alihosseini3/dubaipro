import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { CONSENT_COOKIE } from '@/lib/marketing/consent';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Body = { value?: unknown };

/**
 * Persist the visitor's consent choice as a 1-year cookie.
 *
 * `denied` is stored just like `granted` — we need to remember the
 * decision so we don't re-prompt the user every page load. The cookie
 * is NOT httpOnly because the client needs to read it for any future
 * client-only consent UI changes; it's still SameSite=Lax + Secure.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const value = parsed.data.value;
  if (value !== 'granted' && value !== 'denied') {
    return NextResponse.json({ error: 'value must be granted|denied' }, { status: 400 });
  }

  const c = await cookies();
  c.set(CONSENT_COOKIE, value, {
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });

  // Persist on the user record too — server-side tracking (CAPI / GA4
  // MP) runs from a webhook context where cookies are unavailable, so
  // it relies on `User.consentAt` to honour GDPR.
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { consentAt: value === 'granted' ? new Date() : null }
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true, value });
}
