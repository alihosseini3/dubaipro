import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';

type Props = {
  currentProductId: string;
  categoryId: string | null;
  locale: string;
  /** Max items to render. Default 8 keeps the section visually balanced. */
  limit?: number;
};

/**
 * Server component: lists up to `limit` other products from the same
 * category. Falls back to the most recent products globally when no
 * category is set, so the section is never empty.
 *
 * SEO value: every link is a real `<a href>` SSR anchor pointing at the
 * locale-aware product detail URL — Googlebot can follow each one
 * without executing JS, which strengthens internal-link graph + crawl.
 */
export async function RelatedProducts({
  currentProductId,
  categoryId,
  locale,
  limit = 8
}: Props) {
  const t = await getTranslations({ locale, namespace: 'products' });

  const rows = await prisma.product.findMany({
    where: {
      ...PUBLIC_PRODUCT_WHERE,
      id: { not: currentProductId },
      ...(categoryId ? { categoryId } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      imageUrl: true
    }
  });

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="related-products"
      className="rounded-2xl border border-slate-100 bg-white p-5"
    >
      <h2
        id="related-products"
        className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500"
      >
        {t('relatedTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((p) => (
          <li key={p.id}>
            <Link
              href={`/${locale}/products/${p.slug}`}
              className="group block overflow-hidden rounded-xl border border-slate-100 transition hover:border-slate-300"
            >
              <div className="aspect-square w-full overflow-hidden bg-slate-50">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
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
                  {Number(p.price).toFixed(2)} {p.currency ?? 'USD'}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
