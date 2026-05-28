'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type Variant = 'card' | 'detail';

type Props = {
  productId: string;
  locale: string;
  initialActive?: boolean;
  /** If the viewer is not signed in, we redirect to /login on click. */
  isAuthenticated: boolean;
  variant?: Variant;
  className?: string;
};

export function WishlistButton({
  productId,
  locale,
  initialActive = false,
  isAuthenticated,
  variant = 'card',
  className
}: Props) {
  const t = useTranslations('wishlist');
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      const from = encodeURIComponent(
        typeof window !== 'undefined' ? window.location.pathname : ''
      );
      router.push(`/${locale}/login?from=${from}`);
      return;
    }

    // Optimistic toggle; reconcile on server response.
    const optimistic = !active;
    setActive(optimistic);
    setPending(true);
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      if (!res.ok) throw new Error('toggle_failed');
      const payload = (await res.json()) as {
        data: { added: boolean; count: number };
      };
      setActive(payload.data.added);
      // Refresh server components (navbar badge, wishlist page).
      startTransition(() => router.refresh());
    } catch {
      // Roll back
      setActive(!optimistic);
    } finally {
      setPending(false);
    }
  }

  const isDetail = variant === 'detail';

  const shell = isDetail
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 backdrop-blur-sm shadow-sm transition disabled:opacity-60';

  const stateClass = active
    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? t('removeAria') : t('addAria')}
      title={active ? t('remove') : t('add')}
      className={`${shell} ${isDetail ? stateClass : stateClass} ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          (isDetail ? 'h-4 w-4' : 'h-4 w-4') +
          (pending ? ' animate-pulse' : '') +
          (active ? ' text-rose-500' : '')
        }
        aria-hidden
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {isDetail && <span>{active ? t('inWishlist') : t('add')}</span>}
    </button>
  );
}
