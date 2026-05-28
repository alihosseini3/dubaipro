'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = {
  supplierSlug: string;
};

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Inline review composer rendered above the review list when the viewer
 * is authenticated and has not yet reviewed the supplier. On success it
 * triggers `router.refresh()` so the new review and updated stats appear
 * without a full page reload.
 */
export function SupplierReviewForm({ supplierSlug }: Props) {
  const t = useTranslations('suppliers');
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError(t('reviews.ratingRequired'));
      return;
    }
    if (comment.trim().length === 0) {
      setError(t('reviews.commentRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierSlug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          title: title.trim() || undefined,
          comment: comment.trim()
        })
      });
      if (res.status === 409) {
        setError(t('reviews.alreadyReviewed'));
        return;
      }
      if (!res.ok) {
        setError(t('reviews.errorGeneric'));
        return;
      }
      setRating(0);
      setTitle('');
      setComment('');
      startTransition(() => router.refresh());
    } catch {
      setError(t('reviews.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || pending;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {t('reviews.writeReview')}
      </h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          {t('reviews.ratingLabel')}
        </label>
        <div className="flex gap-1 text-2xl">
          {RATINGS.map((n) => {
            const active = n <= (hover || rating);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n}`}
                className={
                  active
                    ? 'text-amber-500 transition'
                    : 'text-slate-300 transition'
                }
              >
                ★
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="rev-title"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          {t('reviews.titleLabel')}
        </label>
        <input
          id="rev-title"
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('reviews.titlePlaceholder')}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="rev-comment"
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          {t('reviews.commentLabel')}
        </label>
        <textarea
          id="rev-comment"
          rows={4}
          value={comment}
          maxLength={5000}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('reviews.commentPlaceholder')}
          className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? t('reviews.submitting') : t('reviews.submit')}
        </button>
      </div>
    </form>
  );
}
