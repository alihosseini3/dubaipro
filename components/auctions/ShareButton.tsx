'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  title: string;
  /** When set, used instead of `window.location.href`. */
  url?: string;
  className?: string;
  variant?: 'pill' | 'icon' | 'gallery';
};

/**
 * Tiny share button. Uses the Web Share API when available and falls
 * back to copying the page URL to the clipboard. Used both inside the
 * gallery overlay and other surfaces of the auction page.
 */
export function ShareButton({ title, url, className = '', variant = 'pill' }: Props) {
  const t = useTranslations('auctions.detail');
  const [copied, setCopied] = useState(false);

  function onShare() {
    const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, url: shareUrl }).catch(() => null);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onShare}
        title={copied ? t('linkCopied') : t('shareLot')}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur transition hover:bg-black/75 ${className}`}
        aria-label={t('shareLot')}
      >
        <ShareIcon className="h-4 w-4" />
      </button>
    );
  }

  if (variant === 'gallery') {
    return (
      <button
        type="button"
        onClick={onShare}
        className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-black/55 px-2.5 text-[11px] font-bold text-white shadow-md backdrop-blur transition hover:bg-black/75 ${className}`}
      >
        <ShareIcon className="h-3.5 w-3.5" />
        {copied ? t('linkCopied') : t('shareLot')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white shadow-md backdrop-blur transition hover:bg-black/75 ${className}`}
    >
      <ShareIcon className="h-3.5 w-3.5" />
      {copied ? t('linkCopied') : t('shareLot')}
    </button>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
