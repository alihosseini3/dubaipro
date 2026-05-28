import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { SupplierCard } from '@/components/suppliers/SupplierCard';
import { SupplierFilters } from '@/components/suppliers/SupplierFilters';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { prisma } from '@/lib/prisma';
import { listPublicSuppliers } from '@/lib/suppliers';
import { parseSupplierListQuery } from '@/lib/suppliers/query';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const revalidate = 300;

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'suppliers' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/suppliers'),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: { card: 'summary_large_image', title, description }
  };
}

function flattenSearchParams(
  raw: Record<string, string | string[] | undefined>
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') sp.set(k, v);
    else if (Array.isArray(v) && v.length > 0) sp.set(k, v[0]);
  }
  return sp;
}

async function listActiveCountries(): Promise<string[]> {
  const rows = await prisma.supplier.findMany({
    where: { status: 'ACTIVE' },
    distinct: ['country'],
    select: { country: true },
    orderBy: { country: 'asc' }
  });
  return rows.map((r) => r.country).filter(Boolean);
}

export default async function SuppliersIndexPage({
  params,
  searchParams
}: PageParams) {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'suppliers' });
  const sp = flattenSearchParams(raw);
  const filters = parseSupplierListQuery(sp);

  const [{ data, meta }, countries] = await Promise.all([
    listPublicSuppliers(filters),
    listActiveCountries()
  ]);

  const basePath = `/${locale}/suppliers`;
  const buildHref = (page: number) => {
    const next = new URLSearchParams(sp.toString());
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <section className="space-y-8">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/suppliers' }
        ]}
      />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          {t('intro')}
        </p>
      </header>

      <SupplierFilters basePath={basePath} countries={countries} />

      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((s) => (
            <li key={s.id}>
              <SupplierCard supplier={s} locale={locale} />
            </li>
          ))}
        </ul>
      )}

      {meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2 pt-4 text-sm">
          {Array.from({ length: meta.totalPages }).map((_, i) => {
            const page = i + 1;
            const isActive = page === meta.page;
            return (
              <Link
                key={page}
                href={buildHref(page)}
                className={
                  isActive
                    ? 'rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white'
                    : 'rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-slate-400'
                }
              >
                {page}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
