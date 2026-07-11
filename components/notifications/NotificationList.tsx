'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import { useApiQuery } from '@/hooks/use-api';
import {
  notificationHref,
  renderNotificationText,
  type NotificationItem
} from './helpers';

type Payload = {
  data: { items: NotificationItem[]; total: number; unread: number };
};

const PAGE_SIZE = 20;

/** Full notification feed with unread filter, pagination and mark-all-read. */
export function NotificationList({ locale }: { locale: string }) {
  const t = useTranslations('notifications');
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const list = useApiQuery<Payload>('/api/notifications', {
    query: { page, pageSize: PAGE_SIZE, unreadOnly: String(unreadOnly) }
  });

  async function markAllRead() {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      list.refetch();
    } catch {
      /* non-fatal */
    }
  }

  function onOpen(item: NotificationItem) {
    if (!item.readAt) {
      void apiFetch(`/api/notifications/${item.id}/read`, { method: 'POST' }).catch(
        () => {}
      );
    }
  }

  const items = list.data?.data.items ?? [];
  const total = list.data?.data.total ?? 0;
  const unread = list.data?.data.unread ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300 text-orange-500"
          />
          {t('unreadOnly', { count: unread })}
        </label>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-300"
        >
          {t('markAllRead')}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
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
            {items.map((item) => {
              const href = notificationHref(locale, item);
              const body = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                      item.readAt ? 'bg-slate-200' : 'bg-orange-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        item.readAt
                          ? 'text-slate-500'
                          : 'font-medium text-slate-900 dark:text-white'
                      }`}
                    >
                      {renderNotificationText(t, item)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {new Date(item.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li
                  key={item.id}
                  className={item.readAt ? '' : 'bg-orange-50/40 dark:bg-orange-900/10'}
                >
                  {href ? (
                    <Link
                      href={href}
                      onClick={() => onOpen(item)}
                      className="block hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onOpen(item);
                        list.refetch();
                      }}
                      className="block w-full text-start hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              {t('prev')}
            </button>
            <span className="text-slate-500">{t('pageOf', { page, pages })}</span>
            <button
              type="button"
              disabled={page >= pages}
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
