'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useApiQuery } from '@/hooks/use-api';

type Summary = {
  id: string;
  type: 'DIRECT' | 'INQUIRY' | 'SAMPLE' | 'SUPPORT';
  subject: string | null;
  counterpartName: string;
  product: { title: string; slug: string; imageUrl: string | null } | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  isArchived: boolean;
};

type ListPayload = {
  data: { items: Summary[]; total: number; unreadTotal: number };
};

type SearchHit = {
  conversationId: string;
  messageId: string;
  snippet: string;
  subject: string | null;
  createdAt: string;
};

const TYPE_FILTERS = ['ALL', 'DIRECT', 'INQUIRY', 'SAMPLE', 'SUPPORT'] as const;

const TYPE_TONE: Record<string, string> = {
  DIRECT: 'bg-sky-50 text-sky-700',
  INQUIRY: 'bg-orange-50 text-orange-700',
  SAMPLE: 'bg-violet-50 text-violet-700',
  SUPPORT: 'bg-slate-100 text-slate-600'
};

/**
 * Unified inbox — used by both the buyer account area and the supplier
 * dashboard (only `basePath` differs). Type filter, archive toggle, and
 * full-text search over the caller's own messages.
 */
export function ConversationListView({
  locale,
  basePath
}: {
  locale: string;
  basePath: string;
}) {
  const t = useTranslations('messaging');
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>('ALL');
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const list = useApiQuery<ListPayload>('/api/conversations', {
    query: {
      archived: String(archived),
      ...(type !== 'ALL' ? { type } : {})
    }
  });
  const searchResults = useApiQuery<{ data: SearchHit[] }>(
    '/api/conversations/search',
    { query: { q: searchQ }, enabled: searchQ.length >= 2 }
  );

  const items = list.data?.data.items ?? [];

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setType(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                type === f
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
              }`}
            >
              {t(`types.${f}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-orange-500"
          />
          {t('showArchived')}
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearchQ(search.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim().length < 2) setSearchQ('');
          }}
          placeholder={t('searchPlaceholder')}
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
        >
          {t('search')}
        </button>
      </form>

      {/* Search results overlay list */}
      {searchQ.length >= 2 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 dark:border-orange-900">
          <p className="text-xs font-semibold text-orange-700">
            {t('searchResults', { q: searchQ })}
          </p>
          {searchResults.loading ? (
            <p className="mt-2 text-sm text-slate-500">{t('loading')}</p>
          ) : (searchResults.data?.data.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t('noResults')}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {searchResults.data!.data.map((hit) => (
                <li key={hit.messageId}>
                  <Link
                    href={`${basePath}/${hit.conversationId}`}
                    className="block rounded-lg bg-white px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {hit.subject && (
                      <span className="me-2 text-xs font-semibold text-slate-400">
                        {hit.subject}
                      </span>
                    )}
                    <span
                      // ts_headline marks matches with **…**
                      dangerouslySetInnerHTML={{
                        __html: escapeHtml(hit.snippet).replace(
                          /\*\*(.+?)\*\*/g,
                          '<mark>$1</mark>'
                        )
                      }}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Conversation list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
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
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${basePath}/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {item.counterpartName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {item.counterpartName}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${TYPE_TONE[item.type]}`}
                      >
                        {t(`types.${item.type}` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    {item.subject && (
                      <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                        {item.subject}
                      </p>
                    )}
                    <p className="truncate text-xs text-slate-500">
                      {item.lastMessagePreview ?? ''}
                    </p>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.lastMessageAt).toLocaleDateString(locale)}
                    </span>
                    {item.unreadCount > 0 && (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {item.unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
