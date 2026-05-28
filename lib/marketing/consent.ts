import 'server-only';

import { cookies } from 'next/headers';

export const CONSENT_COOKIE = 'mkt_consent';
export type ConsentValue = 'granted' | 'denied' | null;

/**
 * Read the consent cookie. Returns `null` when the visitor hasn't
 * answered the banner yet — the UI uses that to decide whether to
 * show the banner and whether to fire pixels.
 */
export async function readConsent(): Promise<ConsentValue> {
  const c = await cookies();
  const v = c.get(CONSENT_COOKIE)?.value;
  if (v === 'granted' || v === 'denied') return v;
  return null;
}

/**
 * Decide whether tracking can fire on this request.
 *
 * Rules:
 *   - Tracking globally disabled → never.
 *   - Consent NOT required (e.g. non-GDPR jurisdiction) → fire.
 *   - Consent required AND user opted in → fire.
 *   - Anything else → don't fire.
 */
export function canFirePixels(
  trackingEnabled: boolean,
  requireConsent: boolean,
  consent: ConsentValue
): boolean {
  if (!trackingEnabled) return false;
  if (!requireConsent) return true;
  return consent === 'granted';
}
