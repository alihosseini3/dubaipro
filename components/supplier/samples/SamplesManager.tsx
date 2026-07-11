'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type Sample = {
  id: string;
  quantity: number;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SHIPPED' | 'CLOSED';
  conversationId: string | null;
  createdAt: string;
  product: { id: string; title: string; slug: string; imageUrl: string | null };
  buyer: { id: string; name: string };
};

type Payload = {
  data: { items: Sample[]; total: number; statusCounts: Record<string, number> };
};

const STATUSES = ['ALL', 'PENDING', 'ACCEPTED', 'SHIPPED', 'DECLINED', 'CLOSED'] as const;

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-rose-50 text-rose-700',
  SHIPPED: 'bg-sky-50 text-sky-700',
  CLOSED: 'bg-slate-100 text-slate-500'
};

/** Actions available per status — mirrors the service transition matrix. */
const ACTIONS: Record<string, ('accept' | 'decline' | 'ship' | 'close')[]> = {
  PENDING: ['accept', 'decline'],
  ACCEPTED: ['ship', 'close'],
  SHIPPED: ['close'],
  DECLINED: [],
  CLOSED: []
};

export function SamplesManager({ locale }: { locale: string }) {
  const t = useTranslations('samples');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL');

  const list = useApiQuery<Payload>('/api/supplier/samples', {
    query: status === 'ALL' ? {} : { status }
  });
  const act = useApiMutation<{ id: string; action: string }, unknown>(
    (input) => `/api/supplier/samples/${input.id}`,
    'PATCH'
  );

  async function run(id: string, action: string) {
    try {
      await act.mutate({ id, action });
      list.refetch();
    } catch {
      /* act.error rendered below */
    }
  }

  const items = list.data?.data.items ?? [];
  const counts = list.data?.data.statusCounts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === s
                ? 'bg-orange-500 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {t(`status.${s}` as Parameters<typeof t>[0])}
            {s !== 'ALL' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {act.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {act.error.message}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
        {list.loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : list.error ? (
          <p className="px-4 py-10 text-center text-sm text-rose-600">
            {list.error.message}
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((sample) => (
              <li key={sample.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {sample.product.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[sample.status]}`}
                      >
                        {t(`status.${sample.status}` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {sample.buyer.name} · {t('qty', { count: sample.quantity })} ·{' '}
                      {new Date(sample.createdAt).toLocaleDateString(locale)}
                    </p>
                    {sample.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {sample.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-none flex-wrap gap-2">
                    {sample.conversationId && (
                      <Link
                        href={`/${locale}/supplier/messages/${sample.conversationId}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                      >
                        {t('openThread')}
                      </Link>
                    )}
                    {ACTIONS[sample.status].map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={act.loading}
                        onClick={() => run(sample.id, action)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                          action === 'decline'
                            ? 'bg-rose-500 hover:bg-rose-600'
                            : action === 'close'
                              ? 'bg-slate-500 hover:bg-slate-600'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {t(`actions.${action}` as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
