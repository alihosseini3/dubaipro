/**
 * Client-side UTM attribution utilities.
 *
 * - Captures `utm_source`, `utm_medium`, `utm_campaign` from the current URL
 *   and stores them in `localStorage` with a 7-day TTL.
 * - Never stores PII: values are sanitized (lowercased, max 64 chars,
 *   limited charset) before persistence.
 * - Reading is safe on SSR (returns `null`).
 */

export type UtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const STORAGE_KEY = 'mp.utm';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Allow only a conservative charset; reject anything that could be PII. */
function sanitizeUtm(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = String(raw).trim().toLowerCase().slice(0, 64);
  if (!v) return undefined;
  // letters/digits/_/-/./space only; blocks emails, slashes, colons, etc.
  if (!/^[a-z0-9_.\-\s]+$/i.test(v)) return undefined;
  return v;
}

type StoredUtm = {
  s?: string;
  m?: string;
  c?: string;
  exp: number;
};

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Persist UTM params from the current URL. No-op when none are present. */
export function captureUtmFromLocation(): void {
  const store = safeStorage();
  if (!store) return;

  try {
    const url = new URL(window.location.href);
    const s = sanitizeUtm(url.searchParams.get('utm_source'));
    const m = sanitizeUtm(url.searchParams.get('utm_medium'));
    const c = sanitizeUtm(url.searchParams.get('utm_campaign'));

    if (!s && !m && !c) return;

    const payload: StoredUtm = {
      s,
      m,
      c,
      exp: Date.now() + TTL_MS
    };
    store.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Never throw in analytics paths.
  }
}

/** Read the persisted UTM set, or `null` if none/expired. */
export function readStoredUtm(): UtmParams | null {
  const store = safeStorage();
  if (!store) return null;

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUtm;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    const out: UtmParams = {};
    if (parsed.s) out.utmSource = parsed.s;
    if (parsed.m) out.utmMedium = parsed.m;
    if (parsed.c) out.utmCampaign = parsed.c;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
