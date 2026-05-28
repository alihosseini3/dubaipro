'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';

import type {
  NavigationItemDTO,
  NavigationItemType
} from '@/lib/header/service';
import type { PageSummaryDTO } from '@/lib/pages/service';

type Props = {
  initial: NavigationItemDTO[];
  /** Pages available for `type=page` linking. */
  pages: PageSummaryDTO[];
};

/**
 * CRUD + drag-and-drop reordering for the public header's nav items.
 *
 * Reordering uses native HTML5 drag-and-drop (no library): each row is
 * `draggable`, the manager tracks "dragging id" and drop target, and
 * commits a `POST /reorder` once the user releases. Optimistic local
 * state update keeps the list snappy; we revert on server error.
 */
export function NavigationItemsManager({ initial, pages }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Drag state lives in refs so handlers stay reference-stable.
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Sync when parent passes a fresh server snapshot.
  useEffect(() => setItems(initial), [initial]);

  function moveLocally(fromId: string, toId: string) {
    if (fromId === toId) return;
    setItems((list) => {
      const fromIdx = list.findIndex((x) => x.id === fromId);
      const toIdx = list.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return list;
      const next = list.slice();
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  }

  async function commitReorder(orderedIds: string[]) {
    try {
      const res = await fetch('/api/admin/header/nav/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderedIds })
      });
      if (!res.ok) throw new Error('reorder_failed');
      startTransition(() => router.refresh());
    } catch {
      setError('Reorder failed — refreshing.');
      router.refresh();
    }
  }

  async function toggleActive(item: NavigationItemDTO) {
    setPendingId(item.id);
    setItems((list) =>
      list.map((x) => (x.id === item.id ? { ...x, isActive: !x.isActive } : x))
    );
    try {
      await fetch(`/api/admin/header/nav/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive })
      });
      startTransition(() => router.refresh());
    } catch {
      setError('Could not update item.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this navigation link?')) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/header/nav/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setItems((list) => list.filter((x) => x.id !== id));
      startTransition(() => router.refresh());
    } catch {
      setError('Could not delete item.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Navigation links</h2>
          <p className="text-sm text-slate-500">
            Top-level links shown in the navigation bar. Drag to reorder.
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No links yet — add one below.
          </li>
        )}
        {items.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => {
              dragId.current = item.id;
            }}
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
              moveLocally(from, item.id);
              // Commit using the just-updated list. We compute the new
              // order array AFTER the move so we don't depend on
              // setState having flushed yet.
              const next = (() => {
                const list = items.slice();
                const fromIdx = list.findIndex((x) => x.id === from);
                const toIdx = list.findIndex((x) => x.id === item.id);
                if (fromIdx < 0 || toIdx < 0) return list;
                const [removed] = list.splice(fromIdx, 1);
                list.splice(toIdx, 0, removed);
                return list;
              })();
              void commitReorder(next.map((x) => x.id));
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
              overId === item.id ? 'bg-orange-50' : ''
            } ${pendingId === item.id ? 'opacity-60' : ''}`}
          >
            <span className="cursor-grab text-slate-400" aria-label="Drag handle">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden
              >
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-slate-900">
                {item.label}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    item.type === 'PAGE'
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.type === 'PAGE' ? 'Page' : 'Custom'}
                </span>
                <code className="truncate">{item.href}</code>
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(item)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                item.isActive
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {item.isActive ? 'Active' : 'Hidden'}
            </button>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <AddNavForm
        pages={pages}
        onCreated={(item) => {
          setItems((list) => [...list, item]);
          startTransition(() => router.refresh());
        }}
        onError={() => setError('Could not create item.')}
      />
    </section>
  );
}

function AddNavForm({
  pages,
  onCreated,
  onError
}: {
  pages: PageSummaryDTO[];
  onCreated: (item: NavigationItemDTO) => void;
  onError: () => void;
}) {
  const [type, setType] = useState<NavigationItemType>('CUSTOM');
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [pageId, setPageId] = useState('');
  const [busy, setBusy] = useState(false);

  // When the admin picks a page we auto-fill the label so the common
  // case (link to "About us" with label "About us") is one click.
  function selectPage(id: string) {
    setPageId(id);
    if (!id) return;
    const p = pages.find((x) => x.id === id);
    if (p && !label.trim()) setLabel(p.title);
  }

  const ready =
    label.trim().length > 0 &&
    (type === 'CUSTOM' ? href.trim().length > 0 : pageId.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      const body =
        type === 'PAGE'
          ? { label, type: 'PAGE', pageId }
          : { label, type: 'CUSTOM', href };
      const res = await fetch('/api/admin/header/nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onCreated(json.data as NavigationItemDTO);
      setLabel('');
      setHref('');
      setPageId('');
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"
    >
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setType('CUSTOM')}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            type === 'CUSTOM'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
        >
          Custom link
        </button>
        <button
          type="button"
          onClick={() => setType('PAGE')}
          className={`rounded-md px-2.5 py-1 font-medium transition ${
            type === 'PAGE'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
          }`}
          disabled={pages.length === 0}
          title={pages.length === 0 ? 'No pages yet — create one first.' : ''}
        >
          Linked page
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. About us)"
          maxLength={64}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        {type === 'CUSTOM' ? (
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/about"
            maxLength={512}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        ) : (
          <select
            value={pageId}
            onChange={(e) => selectPage(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Select a page…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (/{p.slug}){p.isActive ? '' : ' — hidden'}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={busy || !ready}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add link'}
        </button>
      </div>
    </form>
  );
}
