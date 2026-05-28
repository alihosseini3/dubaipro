import { cookies, headers } from 'next/headers';

/**
 * Resolve the current visitor's stable id.
 *
 * Read order (first hit wins):
 *   1. `ab_vid` cookie — the steady state after the first request.
 *   2. `x-ab-vid` request header — set by middleware on the very first
 *      visit BEFORE the Set-Cookie has reached the browser. Without this
 *      fallback the initial SSR would render the default (un-experimented)
 *      branch and then "flicker" to the variant on the second request.
 */
export async function getVisitorId(): Promise<string | null> {
  const c = await cookies();
  const fromCookie = c.get('ab_vid')?.value;
  if (fromCookie) return fromCookie;

  const h = await headers();
  return h.get('x-ab-vid') || null;
}
