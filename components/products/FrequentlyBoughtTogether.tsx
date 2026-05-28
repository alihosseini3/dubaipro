import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getFrequentlyBoughtTogether } from '@/lib/recommendations/service';

type Props = {
  productId: string;
  locale: string;
  limit?: number;
};

/**
 * Server component: shows products that customers actually bought
 * alongside this one (PAID orders only). Hidden when there isn't
 * enough order history — prevents showing an empty "FBT" section
 * on brand-new SKUs.
 */
export async function FrequentlyBoughtTogether({
  productId,
  locale,
  limit = 4
}: Props) {
  const t = await getTranslations({ locale, namespace: 'products' });
  const items = await getFrequentlyBoughtTogether(productId, limit);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="fbt-heading"
      className="rounded-2xl border border-slate-100 bg-white p-5"
    >
      <h2
        id="fbt-heading"
        className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500"
      >
        {t('frequentlyBoughtTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/${locale}/products/${p.slug}`}
              className="group block overflow-hidden rounded-xl border border-slate-100 transition hover:border-slate-300"
            >
              <div className="aspect-square w-full overflow-hidden bg-slate-50">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.title}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    {t('noImage')}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-xs font-medium text-slate-900">
                  {p.title}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {p.price.toFixed(2)} {p.currency}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
