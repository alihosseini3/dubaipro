import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  supplierReplyContent: string | null;
  supplierReplyAt: string | Date | null;
  createdAt: string | Date;
  user: { id: string; name: string };
};

type Stats = {
  ratingAvg: number;
  ratingCount: number;
  breakdown: Record<number, number>;
};

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex items-center text-amber-500">
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < value ? '' : 'text-slate-300'}>
        ★
      </span>
    ))}
  </span>
);

export function SupplierReviewList({
  reviews,
  stats,
  locale,
  formSlot,
  emptyAfterForm
}: {
  reviews: Review[];
  stats: Stats;
  locale: string;
  /** Optional review-form/auth-prompt rendered above the list. */
  formSlot?: ReactNode;
  /** When true, suppress the empty-state banner because `formSlot` already
   * communicates the call to action. */
  emptyAfterForm?: boolean;
}) {
  const t = useTranslations('suppliers');

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="text-3xl font-semibold text-slate-900">
            {stats.ratingCount > 0 ? stats.ratingAvg.toFixed(1) : '—'}
          </div>
          <Stars value={Math.round(stats.ratingAvg)} />
          <p className="mt-1 text-xs text-slate-500">
            {t('ratingSummary', {
              avg: stats.ratingAvg.toFixed(1),
              count: stats.ratingCount
            })}
          </p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = stats.breakdown[stars] ?? 0;
            const pct =
              stats.ratingCount > 0 ? (count / stats.ratingCount) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-slate-500">{stars}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-500">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {formSlot}

      {reviews.length === 0 ? (
        emptyAfterForm ? null : (
          <p className="text-sm text-slate-500">{t('reviews.noReviews')}</p>
        )
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  {r.isVerifiedPurchase ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      {t('reviews.verifiedPurchase')}
                    </span>
                  ) : null}
                </div>
                <time className="text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString(locale)}
                </time>
              </div>
              {r.title ? (
                <h4 className="mt-2 text-sm font-semibold text-slate-900">
                  {r.title}
                </h4>
              ) : null}
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {r.comment}
              </p>
              <p className="mt-2 text-xs text-slate-500">— {r.user.name}</p>

              {r.supplierReplyContent ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    {t('reviews.supplierReply')}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                    {r.supplierReplyContent}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
