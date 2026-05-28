'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { StarRatingInput } from './StarRatingInput';

type Props = {
  productId: string;
  locale: string;
};

export function ReviewForm({ productId, locale }: Props) {
  const t = useTranslations('reviews');
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (rating < 1 || rating > 5) {
      setError(t('errorInvalidRating'));
      return;
    }
    if (comment.trim().length < 3) {
      setError(t('errorInvalidComment'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, comment })
      });

      if (res.status === 401) {
        router.push(
          `/${locale}/login?redirect=${encodeURIComponent(
            `/${locale}/products`
          )}`
        );
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code =
          typeof json?.error === 'string' ? json.error : 'errorGeneric';
        if (code === 'not_purchased') setError(t('errorNotPurchased'));
        else if (code === 'already_reviewed')
          setError(t('errorAlreadyReviewed'));
        else if (code === 'invalid_rating') setError(t('errorInvalidRating'));
        else if (code === 'invalid_comment') setError(t('errorInvalidComment'));
        else setError(t('errorGeneric'));
        return;
      }

      setSuccess(true);
      setRating(0);
      setComment('');
      startTransition(() => router.refresh());
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900">
        {t('writeReview')}
      </h3>

      <div className="space-y-1">
        <label className="block text-sm text-slate-700">{t('yourRating')}</label>
        <StarRatingInput
          value={rating}
          onChange={setRating}
          disabled={submitting}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="review-comment" className="block text-sm text-slate-700">
          {t('yourComment')}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t('commentPlaceholder')}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {t('successMessage')}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || rating < 1}
        className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
