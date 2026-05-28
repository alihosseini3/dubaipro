import { SmartImage } from '@/components/ui/SmartImage';
import { useTranslations } from 'next-intl';

import type { SupplierPublic } from '@/lib/suppliers/types';

import { SupplierFollowButton } from './SupplierFollowButton';
import { SupplierTierBadge } from './SupplierTierBadge';

type Props = {
  supplier: SupplierPublic;
  locale: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
};

/**
 * Profile hero — banner, logo, name, tier badge, follower count, and the
 * primary follow CTA. Sits at the top of `/suppliers/[slug]`.
 */
export function SupplierHero({
  supplier,
  locale,
  isAuthenticated,
  initialFollowing
}: Props) {
  const t = useTranslations('suppliers');
  const initials = supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  const loginHref = `/${locale}/login?returnTo=/${locale}/suppliers/${supplier.slug}`;

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="relative h-32 w-full bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50 sm:h-44">
        {supplier.bannerUrl ? (
          <SmartImage
            src={supplier.bannerUrl}
            alt=""
            loading="eager"
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-sm">
              {supplier.logoUrl ? (
                <SmartImage
                  src={supplier.logoUrl}
                  alt={supplier.name}
                  loading="eager"
                  sizes="80px"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-slate-500">
                  {initials || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold text-slate-900">
                  {supplier.name}
                </h1>
                <SupplierTierBadge
                  tier={supplier.tier}
                  labels={{
                    verified: t('verifiedBadgeLabel'),
                    guaranteed: t('guaranteedBadgeLabel')
                  }}
                />
                {supplier.isFeatured ? (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                    {t('featuredBadgeLabel')}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {[supplier.city, supplier.country].filter(Boolean).join(' · ')}
              </p>
              {supplier.shortTagline ? (
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  {supplier.shortTagline}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-1">
            <SupplierFollowButton
              supplierSlug={supplier.slug}
              initialFollowing={initialFollowing}
              initialFollowerCount={supplier.followerCount}
              isAuthenticated={isAuthenticated}
              loginHref={loginHref}
            />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              ★
            </dt>
            <dd className="font-semibold text-slate-900">
              {supplier.ratingCount > 0
                ? t('ratingSummary', {
                    avg: supplier.ratingAvg.toFixed(1),
                    count: supplier.ratingCount
                  })
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {t('tabs.products')}
            </dt>
            <dd className="font-semibold text-slate-900">
              {supplier.productCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {t('follow')}
            </dt>
            <dd className="font-semibold text-slate-900">
              {supplier.followerCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {t('about.yearEstablished')}
            </dt>
            <dd className="font-semibold text-slate-900">
              {supplier.yearEstablished ?? '—'}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
