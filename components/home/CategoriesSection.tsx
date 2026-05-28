import Link from 'next/link';

import { listCategories } from '@/lib/categories/service';
import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { localizeArray } from '@/lib/i18n/localize';

type Props = { locale: string; section: HomepageSectionDTO };

const ACCENTS = [
  'from-orange-100 to-orange-50 text-orange-700',
  'from-sky-100 to-sky-50 text-sky-700',
  'from-emerald-100 to-emerald-50 text-emerald-700',
  'from-violet-100 to-violet-50 text-violet-700',
  'from-rose-100 to-rose-50 text-rose-700',
  'from-amber-100 to-amber-50 text-amber-700',
  'from-cyan-100 to-cyan-50 text-cyan-700',
  'from-lime-100 to-lime-50 text-lime-700'
];

/**
 * Category grid — 6–10 tiles linking to `/categories/[slug]`.
 *
 * Source order:
 *   1. `config.categoryIds` (admin curated). Missing IDs are skipped
 *      so a deleted category doesn't break the homepage.
 *   2. Otherwise, the most-populated categories (sorted by name).
 */
export async function CategoriesSection({ locale, section }: Props) {
  const cfgIds = (section.config.categoryIds as string[] | undefined) ?? [];
  const limit = clamp((section.config.limit as number | undefined) ?? 8, 2, 12);

  const all = await listCategories();
  const baseList =
    cfgIds.length > 0
      ? cfgIds
          .map((id) => all.find((c) => c.id === id))
          .filter((x): x is (typeof all)[number] => Boolean(x))
      : all
          .slice()
          .sort((a, b) => b.productCount - a.productCount)
          .slice(0, limit);

  if (baseList.length === 0) return null;

  // Auto-translate category names. Cached after the first locale hit.
  const list = await localizeArray(baseList, locale, ['name']);

  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section aria-labelledby="home-categories" className="space-y-6">
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={ctaHref}
        id="home-categories"
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`${base}/categories/${c.slug}`}
              className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
            >
              <span
                className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl font-black ${ACCENTS[i % ACCENTS.length]}`}
              >
                {c.icon || c.name.slice(0, 1).toUpperCase()}
              </span>
              <h3 className="line-clamp-2 text-sm font-bold text-slate-900 transition group-hover:text-orange-700">
                {c.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------- Shared block used across home sections -------- */

export function SectionHeader({
  id,
  title,
  subtitle,
  ctaLabel,
  ctaHref
}: {
  id?: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2
          id={id}
          className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>
        )}
      </div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 transition hover:text-orange-700"
        >
          {ctaLabel}
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 rtl:-scale-x-100"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
