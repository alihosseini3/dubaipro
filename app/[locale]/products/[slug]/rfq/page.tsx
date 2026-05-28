import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { RfqForm } from '@/components/products/RfqForm';
import { getBaseUrl } from '@/lib/api/base-url';
import type { Product, ProductsResponse } from '@/types/product';

type PageParams = {
  params: Promise<{ locale: string; slug: string }>;
};

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(
      `${base}/api/products?slug=${encodeURIComponent(slug)}&pageSize=1`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ProductsResponse;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rfq' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription')
  };
}

export default async function RfqPage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'rfq' });
  const tProducts = await getTranslations({ locale, namespace: 'products' });
  const product = await fetchProductBySlug(slug);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <nav className="text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-slate-900">
          {tProducts('home')}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/${locale}/products`}
          className="hover:text-slate-900"
        >
          {tProducts('title')}
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/${locale}/products/${product.slug}`}
          className="hover:text-slate-900"
        >
          {product.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{t('title')}</span>
      </nav>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RfqForm productId={product.id} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('productSummary')}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">
              {product.title}
            </p>
            {product.supplier?.name && (
              <p className="mt-1 text-xs text-slate-500">
                {tProducts('by')}{' '}
                <span className="font-medium text-slate-700">
                  {product.supplier.name}
                </span>
              </p>
            )}
            {product.category?.name && (
              <p className="mt-1 text-xs text-slate-500">
                {product.category.name}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">
              {t('negotiationTitle')}
            </p>
            <p className="mt-1">{t('negotiationComingSoon')}</p>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">
              {t('supplierResponseTitle')}
            </p>
            <p className="mt-1">{t('supplierResponseComingSoon')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
