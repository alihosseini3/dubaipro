'use client';

import { useTranslations } from 'next-intl';

/**
 * Social + passwordless buttons. They post to the corresponding
 * placeholder routes so the UX is complete today; replace the fetch
 * targets with real OAuth / OTP flows when the backend is ready.
 */
export function AuthPlaceholders() {
  const t = useTranslations('auth');

  async function handleDisabled(provider: 'google' | 'otp') {
    // Keep the UI honest: visibly disabled but wired so upgrading later
    // only changes the backend.
    window.alert(
      provider === 'google' ? t('googleComingSoon') : t('otpComingSoon')
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative py-2 text-center">
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200" aria-hidden />
        <span className="relative bg-white px-3 text-xs uppercase tracking-wide text-slate-400">
          {t('orContinue')}
        </span>
      </div>

      <button
        type="button"
        onClick={() => handleDisabled('google')}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.6-5.6-5.8S8.9 5.8 12 5.8c1.8 0 3 .8 3.6 1.4l2.5-2.4C16.6 3.4 14.5 2.5 12 2.5c-5.2 0-9.4 4.2-9.4 9.5s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
          />
        </svg>
        <span>{t('continueWithGoogle')}</span>
      </button>

      <button
        type="button"
        onClick={() => handleDisabled('otp')}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M11 18h2" strokeLinecap="round" />
        </svg>
        <span>{t('continueWithOtp')}</span>
      </button>
    </div>
  );
}
