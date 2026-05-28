'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { readStoredUtm } from '@/lib/utm/client';

type Props = {
  /** DB-backed settings. When omitted or disabled, the button is not rendered. */
  settings?: {
    phone: string;
    defaultMessage: string;
    isEnabled: boolean;
    showFloating: boolean;
    showOnProduct: boolean;
  };
  /**
   * Optional product context (used by ProductActions). When provided the
   * button builds a product-focused message and prefers `phone` over the
   * admin fallback in settings.
   */
  phone?: string | null;
  productName?: string;
  price?: number | string | null;
  currency?: string | null;
  url?: string;
  /** Analytics context. */
  productId?: string | null;
  supplierId?: string | null;
};

/**
 * Sanitize a string before embedding in a URL query parameter.
 * Strips control chars and limits length; the final string is still
 * percent-encoded by encodeURIComponent on use.
 */
function sanitize(input: string, max = 400): string {
  return input
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Keep only digits; WhatsApp wa.me requires digits only. */
function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, '');
}

function isProductPath(pathname: string): boolean {
  // Matches /<locale>/products/<slug> but not the listing page.
  return /\/products\/[^/]+$/.test(pathname);
}

export function WhatsAppButton({
  settings,
  phone,
  productName,
  price,
  currency,
  url,
  productId,
  supplierId
}: Props) {
  const t = useTranslations('whatsapp');
  const pathname = usePathname() ?? '';

  const hasProductContext = Boolean(productName);

  // Resolve the runtime URL only when not provided explicitly. This keeps
  // the non-product (global) instance working while avoiding any DOM
  // scraping for the product-context instance.
  const [fallbackUrl, setFallbackUrl] = useState('');
  useEffect(() => {
    if (url || typeof window === 'undefined') return;
    setFallbackUrl(window.location.href);
  }, [url, pathname]);

  if (!settings || !settings.isEnabled || !settings.showFloating) return null;

  const onProduct = hasProductContext || isProductPath(pathname);
  if (onProduct && !settings.showOnProduct) return null;

  // Priority: explicit prop phone (supplier) → global admin phone.
  // Both are normalized to digits-only; supplier must reach 7 digits.
  const sellerNormalized = normalizePhone(phone ?? '');
  const adminNormalized = normalizePhone(settings.phone);
  const normalized =
    sellerNormalized.length >= 7 ? sellerNormalized : adminNormalized;
  if (!normalized) return null;

  const safeUrl = sanitize(url ?? fallbackUrl, 300);
  const productTitle = hasProductContext ? sanitize(productName ?? '', 160) : '';
  const priceNum = typeof price === 'number' ? price : Number(price);
  const priceDisplay =
    hasProductContext && Number.isFinite(priceNum) && priceNum > 0
      ? currency
        ? `${currency} ${priceNum}`
        : String(priceNum)
      : '';

  let message: string;
  if (hasProductContext && productTitle) {
    // Friendly, sales-focused locale-aware multi-line message.
    const lines = [
      `${t('greeting')} 👋`,
      `${t('interested')}: *${productTitle}*`
    ];
    if (priceDisplay) lines.push(`${t('priceLabel')}: ${priceDisplay}`);
    if (safeUrl) lines.push(safeUrl);
    lines.push(t('callToAction'));
    message = lines.join('\n');
  } else {
    const adminMessage = sanitize(settings.defaultMessage ?? '', 500);
    message = safeUrl
      ? `${adminMessage || t('hello')}\n${safeUrl}`
      : adminMessage || t('hello');
  }

  const href = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

  const source = hasProductContext ? 'product' : 'floating';

  /**
   * Fire-and-forget click tracking. Uses `sendBeacon` when available so the
   * request survives tab navigation; falls back to `fetch` with `keepalive`.
   * All errors are swallowed to guarantee the link click is never blocked.
   */
  function trackClick() {
    try {
      // Generate an attribution id for this click and persist it in a
      // first-party cookie so checkout can credit the resulting order
      // back to this WhatsApp touchpoint within 24h.
      const clickId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      try {
        document.cookie = `mp.waclick=${clickId}; path=/; max-age=${24 * 60 * 60}; SameSite=Lax`;
      } catch {
        // Non-fatal; conversion attribution simply degrades to "unknown".
      }

      const utm = readStoredUtm() ?? {};
      const payload = JSON.stringify({
        clickId,
        productId,
        supplierId,
        source,
        ...utm
      });
      const endpoint = '/api/analytics/whatsapp-click';
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function'
      ) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    } catch {
      // Never block the UI on tracking failures.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackClick}
      onAuxClick={trackClick}
      aria-label={t('tooltip')}
      title={t('tooltip')}
      className="group fixed bottom-5 end-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/30 transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 sm:h-16 sm:w-16"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping"
      />
      <svg
        viewBox="0 0 32 32"
        className="relative h-7 w-7 sm:h-8 sm:w-8"
        fill="currentColor"
        aria-hidden
      >
        <path d="M19.11 17.22c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.6.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.41-2.15-1.32-.79-.71-1.33-1.58-1.48-1.85-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.6-1.46-.83-2-.22-.53-.44-.46-.6-.47-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.97 2.64 1.11 2.82c.14.18 1.92 2.93 4.66 4.11.65.28 1.15.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32zM16.02 5.33c-5.88 0-10.66 4.78-10.66 10.66 0 1.88.49 3.72 1.43 5.34L5 27.67l6.5-1.71c1.56.85 3.32 1.3 5.11 1.3h.01c5.87 0 10.66-4.78 10.66-10.66 0-2.85-1.11-5.53-3.12-7.55a10.6 10.6 0 0 0-7.54-3.12zm0 19.55h-.01c-1.6 0-3.17-.43-4.54-1.24l-.33-.19-3.86 1.01 1.03-3.76-.21-.34a8.84 8.84 0 0 1-1.36-4.72c0-4.89 3.98-8.87 8.87-8.87 2.37 0 4.6.92 6.27 2.6a8.81 8.81 0 0 1 2.6 6.27c-.01 4.89-3.99 8.87-8.87 8.87z" />
      </svg>

      <span className="pointer-events-none absolute bottom-full end-0 mb-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
        {t('tooltip')}
      </span>
    </a>
  );
}
