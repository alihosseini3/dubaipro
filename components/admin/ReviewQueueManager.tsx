'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type QueueItem = {
  id: string;
  title: string;
  slug: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  moq: number | null;
  submittedAt: string | null;
  supplier: { id: string; name: string };
  category: { name: string } | null;
};

type QueuePayload = {
  data: { items: QueueItem[]; total: number; page: number; pageSize: number };
};

/**
 * Client half of the review queue. Approve is one click; reject opens an
 * inline reason box (the API requires a reason for rejections).
 */
export function ReviewQueueManager({ locale }: { locale: string }) {
  const t = useTranslations('admin.reviewQueue');
  const [page, setPage] = useState(1);
  const { data, error, loading, refetch } = useApiQuery<QueuePayload>(
    '/api/admin/products/review-queue',
    { query: { page, pageSize: 20 } }
  );

  const review = useApiMutation<
    { id: string; action: 'approve' | 'reject'; reason?: string },
    unknown
  >((input) => `/api/admin/products/${input.id}/review`, 'POST');

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function decide(id: string, action: 'approve' | 'reject') {
    try {
      await review.mutate(
        action === 'reject' ? { id, action, reason: reason.trim() } : { id, action }
      );
      setRejectingId(null);
      setReason('');
      refetch();
    } catch {
      /* review.error rendered below */
    }
  }

  const items = data?.data.items ?? [];
  const total = data?.data.total ?? 0;

  return (
    <div className="space-y-4">
      {review.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {review.error.message}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('pendingCount', { count: total })}
          </h2>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-rose-600">{error.message}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 flex-none rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 flex-none rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/${locale}/admin/products/${item.id}`}
                      className="block truncate text-sm font-semibold text-slate-900 hover:text-orange-600"
                    >
                      {item.title}
                    </a>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.supplier.name}
                      {item.category ? ` · ${item.category.name}` : ''}
                      {' · '}
                      {item.price} {item.currency}
                      {item.moq ? ` · MOQ ${item.moq}` : ''}
                    </p>
                    {item.submittedAt && (
                      <p className="text-xs text-slate-400">
                        {t('submitted', {
                          date: new Date(item.submittedAt).toLocaleString(locale)
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-none gap-2">
                    <button
                      type="button"
                      disabled={review.loading}
                      onClick={() => decide(item.id, 'approve')}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {t('approve')}
                    </button>
                    <button
                      type="button"
                      disabled={review.loading}
                      onClick={() =>
                        setRejectingId(rejectingId === item.id ? null : item.id)
                      }
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {t('reject')}
                    </button>
                  </div>
                </div>

                {rejectingId === item.id && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t('reasonPlaceholder')}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={review.loading || reason.trim().length < 3}
                      onClick={() => decide(item.id, 'reject')}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {t('confirmReject')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {total > 20 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              {t('prev')}
            </button>
            <span className="text-slate-500">
              {t('pageOf', { page, pages: Math.max(1, Math.ceil(total / 20)) })}
            </span>
            <button
              type="button"
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
