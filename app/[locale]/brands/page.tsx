import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { listBrands } from '@/lib/brands/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string }> };

export const revalidate = 3600;

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brands' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/brands'),
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

export default async function BrandsIndexPage({ params }: PageParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brands' });
  const brands = (await listBrands()).filter((b) => b.productCount > 0);

  return (
    <section className="space-y-8">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/brands' }
        ]}
      />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          {t('intro')}
        </p>
      </header>

      {brands.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/${locale}/brands/${b.slug}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400"
              >
                <div className="text-sm font-medium text-slate-900">{b.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {t('productCount', { count: b.productCount })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
