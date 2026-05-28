import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminReviewRow } from '@/components/admin/AdminReviewRow';
import { Stars } from '@/components/reviews/Stars';
import { listAllReviews } from '@/lib/reviews/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminReviewsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.reviews' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const reviews = await listAllReviews({ take: 200 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      {reviews.length === 0 ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-slate-500">
            {tCommon('empty')}
          </p>
        </AdminCard>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  t('headerProduct'),
                  t('headerUser'),
                  t('headerRating'),
                  t('headerComment'),
                  t('headerDate'),
                  t('headerActions')
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/products/${r.product.slug}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {r.product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.user.name}</p>
                    <p className="font-mono text-xs text-slate-500">
                      {r.user.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} size="sm" />
                      <span className="tabular-nums text-slate-700">
                        {r.rating}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-700">
                    <p className="line-clamp-3 whitespace-pre-wrap">
                      {r.comment}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <AdminReviewRow id={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
