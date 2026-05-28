'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';

import type { MegaMenuItemDTO } from '@/lib/header/service';

type CategoryOption = { id: string; name: string; slug: string };

type Props = {
  initial: MegaMenuItemDTO[];
  /** Categories not yet in the mega menu, available for the picker. */
  categories: CategoryOption[];
};

/**
 * Manages the featured-categories list shown inside the mega menu.
 * Same DnD pattern as `<NavigationItemsManager>` plus a category
 * picker (only categories not already featured appear).
 *
 * Each item supports per-row title + image overrides; if blank the
 * storefront falls back to the underlying category's name.
 */
export function MegaMenuManager({ initial, categories }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => setItems(initial), [initial]);

  // Categories the admin can still pick from (= not already featured).
  const usedIds = new Set(items.map((x) => x.categoryId));
  const available = categories.filter((c) => !usedIds.has(c.id));

  async function commitReorder(orderedIds: string[]) {
    try {
      const res = await fetch('/api/admin/header/mega/reorder', {
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

  async function update(id: string, patch: Partial<MegaMenuItemDTO>) {
    setPendingId(id);
    try {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title || null;
      if (patch.image !== undefined) body.image = patch.image || null;
      if (typeof patch.isActive === 'boolean') body.isActive = patch.isActive;
      const res = await fetch(`/api/admin/header/mega/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems((list) =>
        list.map((x) => (x.id === id ? (json.data as MegaMenuItemDTO) : x))
      );
      startTransition(() => router.refresh());
    } catch {
      setError('Could not update item.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this featured category from the mega menu?')) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/header/mega/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setItems((list) => list.filter((x) => x.id !== id));
      startTransition(() => router.refresh());
    } catch {
      setError('Could not remove item.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mega menu</h2>
          <p className="text-sm text-slate-500">
            Featured categories shown when a visitor opens the &ldquo;All
            categories&rdquo; menu. Drag to reorder.
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
            No featured categories yet — add one below.
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
              const next = (() => {
                const list = items.slice();
                const fromIdx = list.findIndex((x) => x.id === from);
                const toIdx = list.findIndex((x) => x.id === item.id);
                if (fromIdx < 0 || toIdx < 0) return list;
                const [removed] = list.splice(fromIdx, 1);
                list.splice(toIdx, 0, removed);
                return list;
              })();
              setItems(next);
              void commitReorder(next.map((x) => x.id));
            }}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition ${
              overId === item.id ? 'bg-orange-50' : ''
            } ${pendingId === item.id ? 'opacity-60' : ''}`}
          >
            <span className="cursor-grab text-slate-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>

            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt=""
                className="h-9 w-9 flex-none rounded-md border border-slate-200 object-cover"
              />
            ) : (
              <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                {item.title.slice(0, 2)}
              </span>
            )}

            <span className="min-w-[180px] flex-1 font-medium text-slate-900">
              {item.title}
            </span>
            <code className="hidden truncate rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 md:block">
              /{item.categorySlug}
            </code>

            <button
              type="button"
              onClick={() => update(item.id, { isActive: !item.isActive })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                item.isActive
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {item.isActive ? 'Visible' : 'Hidden'}
            </button>

            <details className="group basis-full">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                Edit overrides
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  defaultValue={item.title}
                  placeholder="Display title"
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== item.title) update(item.id, { title: v });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <input
                  defaultValue={item.image ?? ''}
                  placeholder="Image URL"
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== (item.image ?? '')) update(item.id, { image: v });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </details>

            <button
              type="button"
              onClick={() => remove(item.id)}
              className="rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <AddMegaForm
        available={available}
        onCreated={(item) => {
          setItems((list) => [...list, item]);
          startTransition(() => router.refresh());
        }}
        onError={() => setError('Could not add category.')}
      />
    </section>
  );
}

function AddMegaForm({
  available,
  onCreated,
  onError
}: {
  available: CategoryOption[];
  onCreated: (item: MegaMenuItemDTO) => void;
  onError: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/header/mega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onCreated(json.data as MegaMenuItemDTO);
      setCategoryId('');
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
        Every category is already featured.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]">
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
      >
        <option value="">Pick a category to feature…</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || !categoryId}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? 'Adding…' : 'Add to menu'}
      </button>
    </form>
  );
}
