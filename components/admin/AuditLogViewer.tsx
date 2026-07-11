'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useApiQuery } from '@/hooks/use-api';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  supplierId: string | null;
  diff: unknown;
  metadata: { ip?: string; userAgent?: string } | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
};

type Payload = { data: { items: AuditRow[]; nextCursor: string | null } };

/**
 * Cursor-paginated audit viewer: "load more" appends pages (keyset — no
 * OFFSET), filters restart the stream from the top.
 */
export function AuditLogViewer() {
  const t = useTranslations('admin.auditLogs');
  const locale = useLocale();

  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [applied, setApplied] = useState({ action: '', entityType: '' });
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const query = useApiQuery<Payload>('/api/admin/audit-logs', {
    query: {
      pageSize: 30,
      ...(applied.action ? { action: applied.action } : {}),
      ...(applied.entityType ? { entityType: applied.entityType } : {}),
      ...(cursor ? { cursor } : {})
    }
  });

  // Append arriving pages; dedupe by row id so a stale response (from before
  // a cursor change) can never double-insert.
  useEffect(() => {
    if (query.loading || !query.data) return;
    const fresh = query.data.data.items.filter((r) => !seenIdsRef.current.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) seenIdsRef.current.add(r.id);
    setRows((prev) => [...prev, ...fresh]);
  }, [query.data, query.loading]);

  const nextCursor = query.data?.data.nextCursor ?? null;

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    seenIdsRef.current = new Set();
    setRows([]);
    setCursor(null);
    setApplied({ action: action.trim(), entityType: entityType.trim() });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="flex flex-wrap gap-2">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t('filterAction')}
          className="h-10 w-56 rounded-lg border border-slate-300 px-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder={t('filterEntity')}
          className="h-10 w-44 rounded-lg border border-slate-300 px-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t('apply')}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {query.error ? (
          <p className="px-4 py-8 text-center text-sm text-rose-600">
            {query.error.message}
          </p>
        ) : rows.length === 0 && query.loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-start">{t('colTime')}</th>
                  <th className="px-4 py-2 text-start">{t('colActor')}</th>
                  <th className="px-4 py-2 text-start">{t('colAction')}</th>
                  <th className="px-4 py-2 text-start">{t('colEntity')}</th>
                  <th className="px-4 py-2 text-start">{t('colDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-2">
                      {row.actor ? (
                        <>
                          <span className="font-medium text-slate-900">
                            {row.actor.name}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {row.actor.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          SYSTEM
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {row.entityType}
                      {row.entityId && (
                        <span className="block font-mono text-[10px] text-slate-400">
                          {row.entityId}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-2 text-[11px] text-slate-500">
                      {row.diff ? (
                        <code className="line-clamp-2 break-all">
                          {JSON.stringify(row.diff)}
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button
              type="button"
              disabled={query.loading}
              onClick={() => setCursor(nextCursor)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {query.loading ? t('loading') : t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
