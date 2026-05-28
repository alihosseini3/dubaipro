'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

type Props = {
  basePath: string;
  countries: string[];
};

const TIERS = ['STANDARD', 'VERIFIED', 'GUARANTEED'] as const;
const BUSINESS = [
  'MANUFACTURER',
  'TRADING_COMPANY',
  'DISTRIBUTOR',
  'WHOLESALER',
  'AGENT',
  'OTHER'
] as const;
const SORTS = ['recent', 'top-rated', 'most-followed', 'name'] as const;

/**
 * Top-of-listing filter bar. Updates `?q&country&tier&businessType&featured&sort`
 * via `router.push` — server component re-renders with the new params.
 */
export function SupplierFilters({ basePath, countries }: Props) {
  const t = useTranslations('suppliers');
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function patch(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete('page'); // any filter change resets pagination
    startTransition(() => {
      router.push(`${basePath}?${sp.toString()}`);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
      <input
        type="search"
        defaultValue={params.get('q') ?? ''}
        placeholder={t('searchPlaceholder')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') patch({ q: e.currentTarget.value });
        }}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none lg:col-span-2"
      />

      <select
        value={params.get('country') ?? ''}
        onChange={(e) => patch({ country: e.target.value || undefined })}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">{t('filterCountry')}</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={params.get('tier') ?? ''}
        onChange={(e) => patch({ tier: e.target.value || undefined })}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">{t('tierAll')}</option>
        {TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {tier === 'STANDARD'
              ? t('tierStandard')
              : tier === 'VERIFIED'
                ? t('tierVerified')
                : t('tierGuaranteed')}
          </option>
        ))}
      </select>

      <select
        value={params.get('sort') ?? 'recent'}
        onChange={(e) =>
          patch({ sort: e.target.value === 'recent' ? undefined : e.target.value })
        }
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {s === 'recent'
              ? t('sortRecent')
              : s === 'top-rated'
                ? t('sortTopRated')
                : s === 'most-followed'
                  ? t('sortMostFollowed')
                  : t('sortName')}
          </option>
        ))}
      </select>

      <select
        value={params.get('businessType') ?? ''}
        onChange={(e) => patch({ businessType: e.target.value || undefined })}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">{t('businessAll')}</option>
        {BUSINESS.map((b) => (
          <option key={b} value={b}>
            {t(`business_${b}` as const)}
          </option>
        ))}
      </select>

      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={params.get('featured') === 'true'}
          onChange={(e) =>
            patch({ featured: e.target.checked ? 'true' : undefined })
          }
          className="h-4 w-4 rounded border-slate-300"
        />
        {t('filterFeatured')}
      </label>
    </div>
  );
}
