import 'server-only';

import { cookies } from 'next/headers';

import { SUPPORTED_CURRENCIES } from '@/types/currency';
import type { Currency } from '@/types/currency';

/**
 * Cookie name that stores the visitor's preferred display currency.
 *
 * Locale still drives the default (`getUserCurrency`), but if the user
 * picks a different currency from the header switcher we honour it
 * across the whole session via this cookie. 1-year lifetime mirrors
 * locale and consent cookies.
 */
export const CURRENCY_COOKIE = 'dp_currency';
export const CURRENCY_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Read the cookie and narrow it to a {@link Currency}. Returns `null`
 * for missing or invalid values so callers can fall back to the
 * locale default.
 */
export async function readCurrencyCookie(): Promise<Currency | null> {
  const c = await cookies();
  const value = c.get(CURRENCY_COOKIE)?.value;
  if (!value) return null;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : null;
}
