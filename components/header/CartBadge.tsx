import Link from 'next/link';

import { getItemCount } from '@/lib/cart/service';

type Props = {
  locale: string;
  userId: string | null;
  label: string;
  tone?: 'dark' | 'light';
  compact?: boolean;
};

/**
 * Cart icon for the dark main header. SSR-resolves the count when the
 * user is logged in (zero DB hit for guests). The badge animates in
 * with a tiny pulse via the `animate-pop` keyframe in globals.css so
 * the change feels alive after add-to-cart navigations.
 */
export async function CartBadge({
  locale,
  userId,
  label,
  tone = 'dark',
  compact = false
}: Props) {
  const count = userId ? await getItemCount(userId).catch(() => 0) : 0;
  const isLight = tone === 'light';

  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={label}
      className={`group relative inline-flex h-11 min-h-[44px] items-center rounded-xl px-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
        compact
          ? 'w-11 justify-center'
          : 'gap-2'
      } ${
        isLight
          ? 'text-slate-700 hover:bg-slate-100 hover:text-orange-600'
          : 'text-white hover:bg-white/10 hover:text-orange-300'
      }`}
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
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
        </svg>
        {count > 0 && (
          <span
            key={count}
            className={`absolute -end-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white animate-pop ${
              isLight
                ? 'shadow-[0_0_0_2px_#ffffff]'
                : 'shadow-[0_0_0_2px_#0F172A]'
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      {!compact && (
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
            {label}
          </span>
          <span className="text-xs font-semibold">
            {count > 0 ? `${count > 99 ? '99+' : count}` : '0'}
          </span>
        </span>
      )}
    </Link>
  );
}
