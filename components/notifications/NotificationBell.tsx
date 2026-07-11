'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import {
  notificationHref,
  renderNotificationText,
  type NotificationItem
} from './helpers';

const BADGE_POLL_MS = 30_000;

/**
 * Header bell: 30s badge polling, dropdown with the latest notifications,
 * mark-all-read. Rendered only for authenticated users.
 */
export function NotificationBell({ locale }: { locale: string }) {
  const t = useTranslations('notifications');
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      apiFetch<{ data: { total: number } }>('/api/notifications/unread')
        .then((res) => setCount(res.data.total))
        .catch(() => {});
    load();
    const timer = setInterval(load, BADGE_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ data: { items: NotificationItem[] } }>('/api/notifications', {
      query: { page: 1, pageSize: 8 }
    })
      .then((res) => setItems(res.data.items))
      .catch(() => setItems([]));

    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  async function markAllRead() {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setCount(0);
      setItems((prev) =>
        prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ??
        prev
      );
    } catch {
      /* non-fatal */
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('bellLabel')}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-bold text-slate-900">{t('title')}</span>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-orange-600 hover:underline"
            >
              {t('markAllRead')}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {t('loading')}
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {t('empty')}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const href = notificationHref(locale, item);
                  const body = (
                    <div
                      className={`px-3 py-2.5 text-sm ${
                        item.readAt ? 'text-slate-500' : 'font-medium text-slate-900'
                      }`}
                    >
                      <p className="line-clamp-2">
                        {renderNotificationText(t, item)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                  );
                  return (
                    <li key={item.id} className={item.readAt ? '' : 'bg-orange-50/50'}>
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            href={`/${locale}/account/notifications`}
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-3 py-2 text-center text-xs font-bold text-orange-600 hover:bg-orange-50"
          >
            {t('viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
