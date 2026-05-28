'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';

import type { PageSummaryDTO, PageStatus } from '@/lib/pages/service';

type Props = {
  initial: PageSummaryDTO[];
  initialTotal: number;
  locale: string;
};

const LOCALES = [
  { value: '', label: 'All locales' },
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'فارسی' },
  { value: 'ar', label: 'العربية' },
  { value: 'ur', label: 'اردو' },
];

const PAGE_LIMIT = 20;

export function PagesManager({ initial, initialTotal, locale }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PageStatus | ''>('');
  const [localeFilter, setLocaleFilter] = useState('');
  const [page, setPage] = useState(1);

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setItems(initial); setTotal(initialTotal); }, [initial, initialTotal]);

  const fetchPages = async (
    q: string,
    st: string,
    loc: string,
    pg: number
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (st) params.set('status', st);
      if (loc) params.set('locale', loc);
      params.set('page', String(pg));
      params.set('limit', String(PAGE_LIMIT));
      const res = await fetch(`/api/admin/pages?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchPages(v, statusFilter, localeFilter, 1), 350);
  }

  function handleFilterChange(st: string, loc: string) {
    setStatusFilter(st as PageStatus | '');
    setLocaleFilter(loc);
    setPage(1);
    void fetchPages(search, st, loc, 1);
  }

  function handlePageChange(pg: number) {
    setPage(pg);
    void fetchPages(search, statusFilter, localeFilter, pg);
  }

  async function toggleStatus(item: PageSummaryDTO) {
    const nextStatus: PageStatus = item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setPendingId(item.id);
    setItems((list) =>
      list.map((x) =>
        x.id === item.id
          ? { ...x, status: nextStatus, isActive: nextStatus === 'PUBLISHED' }
          : x
      )
    );
    try {
      await fetch(`/api/admin/pages/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      startTransition(() => router.refresh());
    } catch {
      setError('Could not update status.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this page? Nav items linked to it will lose their target.'))
      return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setItems((list) => list.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      startTransition(() => router.refresh());
    } catch {
      setError('Could not delete page.');
    } finally {
      setPendingId(null);
    }
  }

  async function commitReorder(orderedIds: string[]) {
    try {
      await fetch('/api/admin/pages/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderedIds }),
      });
      startTransition(() => router.refresh());
    } catch {
      setError('Reorder failed.');
    }
  }

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pages</h2>
          <p className="text-sm text-slate-500">
            {total} page{total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search title or slug…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value, localeFilter)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
        <select
          value={localeFilter}
          onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          {LOCALES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Table */}
      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <div className="hidden grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid">
          <span />
          <span>Page</span>
          <span>Status</span>
          <span>SEO</span>
          <span>Sections</span>
          <span>Actions</span>
        </div>

        {items.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {search || statusFilter || localeFilter ? 'No pages match your filters.' : 'No pages yet — create your first one below.'}
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => { dragId.current = item.id; }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId.current && dragId.current !== item.id) setOverId(item.id);
              }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId.current;
                setOverId(null);
                dragId.current = null;
                if (!from || from === item.id) return;
                const next = items.slice();
                const fromIdx = next.findIndex((x) => x.id === from);
                const toIdx = next.findIndex((x) => x.id === item.id);
                if (fromIdx < 0 || toIdx < 0) return;
                const [removed] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, removed);
                setItems(next);
                void commitReorder(next.map((x) => x.id));
              }}
              className={`grid grid-cols-1 gap-y-1 px-4 py-3 text-sm transition sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center sm:gap-4
                ${overId === item.id ? 'bg-orange-50' : ''}
                ${pendingId === item.id ? 'opacity-60' : ''}`}
            >
              {/* drag handle */}
              <span className="hidden cursor-grab text-slate-300 hover:text-slate-500 sm:inline">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
              </span>

              {/* title + slug + locale */}
              <div className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{item.title}</span>
                <div className="flex items-center gap-2">
                  <code className="truncate text-[11px] text-slate-400">/{item.slug}</code>
                  {item.locale && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 uppercase">
                      {item.locale}
                    </span>
                  )}
                </div>
              </div>

              {/* status badge */}
              <button
                type="button"
                onClick={() => toggleStatus(item)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition
                  ${item.status === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {item.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </button>

              {/* seo badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium
                  ${item.hasSeo ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                title={item.hasSeo ? 'SEO configured' : 'No SEO data'}
              >
                {item.hasSeo ? '✓ SEO' : '— SEO'}
              </span>

              {/* section count */}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-center text-xs text-slate-500">
                {item.sectionCount} block{item.sectionCount !== 1 ? 's' : ''}
              </span>

              {/* actions */}
              <div className="flex items-center gap-1">
                <a
                  href={`/${locale}/${item.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title="View live"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
                <a
                  href={`/${locale}/admin/pages/${item.id}`}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Edit
                </a>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-slate-50"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-slate-50"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <AddPageForm
        onCreated={(item) => {
          setItems((list) => [item, ...list]);
          setTotal((t) => t + 1);
          startTransition(() => router.refresh());
        }}
        onError={(msg) => setError(msg)}
      />
    </section>
  );
}

function AddPageForm({
  onCreated,
  onError,
}: {
  onCreated: (item: PageSummaryDTO) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug: slug.trim() || undefined }),
      });
      if (!res.ok) throw new Error('create_failed');
      const json = await res.json();
      onCreated(json.data as PageSummaryDTO);
      setTitle('');
      setSlug('');
    } catch {
      onError('Could not create page.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:grid-cols-[2fr_1.5fr_auto]"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Page title (e.g. About us)"
        maxLength={120}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug (auto-generated)"
        maxLength={96}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? 'Creating…' : '+ New page'}
      </button>
    </form>
  );
}
