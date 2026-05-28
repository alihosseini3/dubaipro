import Link from 'next/link';

import { getWishlistCount } from '@/lib/wishlist/service';

type Props = {
  locale: string;
  userId: string;
};

export async function WishlistBadge({ locale, userId }: Props) {
  const count = await getWishlistCount(userId).catch(() => 0);
  return (
    <Link
      href={`/${locale}/account/wishlist`}
      className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
      aria-label="Wishlist"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
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
        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
