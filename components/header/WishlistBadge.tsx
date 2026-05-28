import Link from 'next/link';

import { getWishlistCount } from '@/lib/wishlist/service';

type Props = {
  locale: string;
  userId: string | null;
  label: string;
};

/**
 * Wishlist icon for the dark main header. Mirrors {@link CartBadge}
 * with a heart glyph and rose-tinted badge, and the same SSR count
 * pattern (zero DB hit for guests).
 */
export async function WishlistBadge({ locale, userId, label }: Props) {
  const count = userId ? await getWishlistCount(userId).catch(() => 0) : 0;

  return (
    <Link
      href={`/${locale}/account/wishlist`}
      aria-label={label}
      className="group relative hidden h-11 min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-white transition hover:bg-white/10 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:inline-flex"
    >
      <span className="relative">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 transition group-hover:scale-110"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        {count > 0 && (
          <span
            key={count}
            className="absolute -end-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_#0F172A] animate-pop"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hidden flex-col items-start leading-tight md:flex">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className="text-xs font-semibold">
          {count > 0 ? `${count > 99 ? '99+' : count}` : '0'}
        </span>
      </span>
    </Link>
  );
}
