'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type PayButtonProps = {
  orderId: string;
  locale: string;
  provider?: 'stripe';
};

/**
 * Client-side "Pay" button.
 *
 * Calls our API to create a payment intent, then redirects the browser
 * to the hosted checkout page returned by the gateway.
 */
export function PayButton({ orderId, locale, provider = 'stripe' }: PayButtonProps) {
  const t = useTranslations('payment');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, provider, locale })
      });

      const payload = (await res.json().catch(() => ({}))) as {
        data?: { redirectUrl?: string };
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(payload.message ?? payload.error ?? `status ${res.status}`);
      }

      const url = payload.data?.redirectUrl;
      if (!url) throw new Error(t('errorNoRedirect'));

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePay}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? (
          <>
            <Spinner />
            {t('redirecting')}
          </>
        ) : (
          <>
            <LockIcon />
            {t('payNow')}
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-slate-400">
        {t('poweredBy', { provider: provider === 'stripe' ? 'Stripe' : provider })}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
