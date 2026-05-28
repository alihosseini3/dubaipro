import { SmartImage } from '@/components/ui/SmartImage';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import type { SupplierCard as TSupplierCard } from '@/lib/suppliers/types';

import { SupplierTierBadge } from './SupplierTierBadge';

type Props = {
  supplier: TSupplierCard;
  locale: string;
};

/**
 * Listing card used in `/suppliers` grid and home rails. Pure server-side
 * component (uses next-intl `useTranslations`) — no interactivity. Click
 * navigates to the public profile via slug.
 */
export function SupplierCard({ supplier, locale }: Props) {
  const t = useTranslations('suppliers');
  const href = `/${locale}/suppliers/${supplier.slug}`;
  const initials = supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          {supplier.logoUrl ? (
            <SmartImage
              src={supplier.logoUrl}
              alt={supplier.name}
              sizes="48px"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
              {initials || '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {supplier.name}
            </h3>
            <SupplierTierBadge
              tier={supplier.tier}
              compact
              labels={{
                verified: t('verifiedBadgeLabel'),
                guaranteed: t('guaranteedBadgeLabel')
              }}
            />
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {supplier.country}
          </p>
        </div>
      </div>

      {supplier.shortTagline ? (
        <p className="mt-3 line-clamp-2 text-xs text-slate-600">
          {supplier.shortTagline}
        </p>
      ) : null}

      <dl className="mt-auto grid grid-cols-3 gap-1 pt-4 text-center text-[11px] text-slate-500">
        <div>
          <dt className="text-slate-400">★</dt>
          <dd className="font-medium text-slate-700">
            {supplier.ratingCount > 0 ? supplier.ratingAvg.toFixed(1) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">{t('tabs.products')}</dt>
          <dd className="font-medium text-slate-700">{supplier.productCount}</dd>
        </div>
        <div>
          <dt className="text-slate-400">{t('follow')}</dt>
          <dd className="font-medium text-slate-700">{supplier.followerCount}</dd>
        </div>
      </dl>
    </Link>
  );
}
