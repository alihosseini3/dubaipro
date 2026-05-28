import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE
} from '@/lib/currency/cookie';
import { SUPPORTED_CURRENCIES } from '@/types/currency';

export const runtime = 'nodejs';

/**
 * Persist the visitor's currency choice. Body: `{ "value": "AED" }`.
 *
 * Returns 200 with the stored value, 400 for an unsupported currency.
 * The route is intentionally unauthenticated — anyone can change
 * their own display preference, just like locale.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const value = (body as { value?: unknown })?.value;
  if (
    typeof value !== 'string' ||
    !(SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  ) {
    return NextResponse.json({ error: 'invalid_currency' }, { status: 400 });
  }

  const c = await cookies();
  c.set(CURRENCY_COOKIE, value, {
    maxAge: CURRENCY_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });

  return NextResponse.json({ ok: true, value });
}
