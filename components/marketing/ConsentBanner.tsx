'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  trackingEnabled: boolean;
  requireConsent: boolean;
};

/**
 * Minimal GDPR-style consent banner. Stays mounted until the visitor
 * picks a side, then POSTs the choice so the server can set an
 * httpOnly-ish cookie and any subsequent navigation already knows
 * whether to load the pixels.
 *
 * We deliberately don't show this when consent isn't required — the
 * server-side check in `RetargetingPixels` already guards visibility,
 * but the prop lets us short-circuit defensively.
 */
export function ConsentBanner({ trackingEnabled, requireConsent }: Props) {
  const t = useTranslations('consent');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (hidden || !trackingEnabled || !requireConsent) return null;

  async function decide(value: 'granted' | 'denied') {
    setBusy(true);
    try {
      await fetch('/api/marketing/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      setHidden(true);
      // Reload so the layout re-renders with pixels loaded (or not).
      // Cheaper than rolling our own client-side bootstrapper.
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm font-medium text-slate-900">{t('title')}</p>
      <p className="mt-1 text-xs text-slate-600">{t('body')}</p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('denied')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {t('decline')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('granted')}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
