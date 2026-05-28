import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import {
  getProductRatingStats,
  getUserReviewForProduct,
  hasUserPurchasedProduct,
  listReviewsForProduct
} from '@/lib/reviews/service';

import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';

type Props = {
  productId: string;
  locale: string;
};

function formatDate(d: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export async function ReviewsSection({ productId, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'reviews' });

  const [reviews, stats, user] = await Promise.all([
    listReviewsForProduct(productId),
    getProductRatingStats(productId),
    getCurrentUser()
  ]);

  let canReview = false;
  let hasReviewed = false;
  if (user) {
    const [existing, purchased] = await Promise.all([
      getUserReviewForProduct(user.id, productId),
      hasUserPurchasedProduct(user.id, productId)
    ]);
    hasReviewed = !!existing;
    canReview = purchased && !existing;
  }

  const avg = stats.average ? stats.average.toFixed(1) : '0.0';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{t('title')}</h2>
          <div className="mt-2 flex items-center gap-3">
            <Stars value={stats.average} size="lg" />
            <span className="text-lg font-semibold text-slate-900">{avg}</span>
            <span className="text-sm text-slate-500">
              {t('ratingCount', { count: stats.count })}
            </span>
          </div>
        </div>
      </header>

      {!user ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Link
            href={`/${locale}/login`}
            className="font-semibold text-indigo-700 hover:underline"
          >
            {t('loginToReview')}
          </Link>
        </div>
      ) : hasReviewed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {t('alreadyReviewed')}
        </div>
      ) : canReview ? (
        <ReviewForm productId={productId} locale={locale} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {t('mustPurchase')}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {r.user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {r.user.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(r.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <Stars value={r.rating} size="sm" />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {r.comment}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
