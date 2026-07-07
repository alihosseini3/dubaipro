'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

import { AuctionItemsEditor } from './editors/AuctionItemsEditor';
import { CardsEditor } from './editors/CardsEditor';
import { ImageUploader } from './editors/ImageUploader';
import { ItemPicker } from './editors/ItemPicker';
import { LimitField } from './editors/LimitField';
import { StringListEditor } from './editors/StringListEditor';
import { TrustItemsEditor } from './editors/TrustItemsEditor';

type Props = { initial: HomepageSectionDTO[] };

const TYPE_LABELS: Record<HomepageSectionDTO['type'], string> = {
  HERO: 'Hero',
  CATEGORIES: 'Categories grid',
  FEATURED_PRODUCTS: 'Featured products',
  TRUST: 'Trust badges',
  BECOME_SUPPLIER: 'Become supplier',
  GLOBAL_SHOPPING: 'Global shopping',
  TOP_SUPPLIERS: 'Top suppliers',
  AUCTION: 'Auctions',
  BLOG: 'Blog'
};

const TYPE_COLORS: Record<HomepageSectionDTO['type'], string> = {
  HERO: 'bg-orange-100 text-orange-700',
  CATEGORIES: 'bg-sky-100 text-sky-700',
  FEATURED_PRODUCTS: 'bg-emerald-100 text-emerald-700',
  TRUST: 'bg-violet-100 text-violet-700',
  BECOME_SUPPLIER: 'bg-amber-100 text-amber-700',
  GLOBAL_SHOPPING: 'bg-cyan-100 text-cyan-700',
  TOP_SUPPLIERS: 'bg-indigo-100 text-indigo-700',
  AUCTION: 'bg-fuchsia-100 text-fuchsia-700',
  BLOG: 'bg-lime-100 text-lime-700'
};

/**
 * Admin homepage builder. Reuses the same drag-and-drop pattern as
 * `NavigationItemsManager` and `MegaMenuManager`:
 *
 *   - Each row is `draggable`. Drag updates only `dragId.current` so
 *     React doesn't re-render until the drop.
 *   - On drop we (a) update local state for instant feedback,
 *     (b) POST `/reorder` and refresh the route to invalidate caches.
 *
 * Toggles use a small POST to `/toggle`. Edit dialogs are inline
 * forms — open one row at a time so the page stays scannable.
 */
export function SectionsManager({ initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<HomepageSectionDTO[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => setItems(initial), [initial]);

  function moveLocally(fromId: string, toId: string) {
    setItems((prev) => {
      const list = prev.slice();
      const fromIdx = list.findIndex((x) => x.id === fromId);
      const toIdx = list.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [removed] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, removed);
      return list;
    });
  }

  async function commitReorder(orderedIds: string[]) {
    try {
      const res = await fetch('/api/admin/homepage/reorder', {
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

  async function toggleActive(id: string, active: boolean) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error('toggle_failed');
      // Optimistic local update so the switch flips immediately;
      // refresh repulls the canonical list afterwards.
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, isActive: active } : x))
      );
      startTransition(() => router.refresh());
    } catch {
      setError('Toggle failed — try again.');
    } finally {
      setPendingId(null);
    }
  }

  async function saveEdit(id: string, payload: Partial<HomepageSectionDTO>) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('save_failed');
      const json = (await res.json()) as { data: HomepageSectionDTO };
      setItems((prev) => prev.map((x) => (x.id === id ? json.data : x)));
      setEditingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError('Save failed — try again.');
    } finally {
      setPendingId(null);
    }
  }

  async function addSection(type: HomepageSectionDTO['type']) {
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: TYPE_LABELS[type],
          isActive: true,
          config: {}
        })
      });
      if (!res.ok) throw new Error('create_failed');
      const json = (await res.json()) as { data: HomepageSectionDTO };
      setItems((prev) => [...prev, json.data]);
      // Open the new row's editor immediately so the admin can fill
      // it in without an extra click.
      setEditingId(json.data.id);
      startTransition(() => router.refresh());
    } catch {
      setError('Add failed — try again.');
    }
  }

  async function duplicate(item: HomepageSectionDTO) {
    setPendingId(item.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/homepage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          title: `${item.title} (copy)`,
          subtitle: item.subtitle,
          ctaLabel: item.ctaLabel,
          ctaHref: item.ctaHref,
          ctaSecondaryLabel: item.ctaSecondaryLabel,
          ctaSecondaryHref: item.ctaSecondaryHref,
          badge: item.badge,
          imageUrl: item.imageUrl,
          config: item.config,
          isActive: false
        })
      });
      if (!res.ok) throw new Error('duplicate_failed');
      const json = (await res.json()) as { data: HomepageSectionDTO };
      setItems((prev) => [...prev, json.data]);
      startTransition(() => router.refresh());
    } catch {
      setError('Duplicate failed — try again.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this section? This cannot be undone.')) return;
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) setEditingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError('Delete failed — try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {items.length} {items.length === 1 ? 'section' : 'sections'} ·{' '}
          {items.filter((x) => x.isActive).length} active
        </p>
        <AddSectionMenu onAdd={addSection} />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const expanded = editingId === item.id;
          return (
            <li
              key={item.id}
              draggable={!expanded}
              onDragStart={() => {
                dragId.current = item.id;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId.current && dragId.current !== item.id)
                  setOverId(item.id);
              }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId.current;
                setOverId(null);
                dragId.current = null;
                if (!from || from === item.id) return;
                moveLocally(from, item.id);
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
              className={`rounded-xl border bg-white shadow-sm transition ${
                overId === item.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
              } ${pendingId === item.id ? 'opacity-60' : ''}`}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span
                  className="cursor-grab text-slate-400"
                  aria-label="Drag handle"
                  title="Drag to reorder"
                >
                  <DragIcon />
                </span>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    TYPE_COLORS[item.type]
                  }`}
                >
                  {TYPE_LABELS[item.type]}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.title || <em className="text-slate-400">Untitled</em>}
                  </p>
                  {item.subtitle && (
                    <p className="truncate text-xs text-slate-500">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                <ToggleSwitch
                  checked={item.isActive}
                  disabled={pendingId === item.id}
                  onChange={(v) => void toggleActive(item.id, v)}
                />

                <button
                  type="button"
                  onClick={() => setEditingId(expanded ? null : item.id)}
                  className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {expanded ? 'Close' : 'Edit'}
                </button>

                <RowMenu
                  onDuplicate={() => void duplicate(item)}
                  onDelete={() => void remove(item.id)}
                  disabled={pendingId === item.id}
                />
              </div>

              {/* Inline editor */}
              {expanded && (
                <SectionEditor
                  section={item}
                  saving={pendingId === item.id}
                  onSave={(payload) => void saveEdit(item.id, payload)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function SectionEditor({
  section,
  saving,
  onSave,
  onCancel
}: {
  section: HomepageSectionDTO;
  saving: boolean;
  onSave: (payload: Partial<HomepageSectionDTO>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '');
  const [badge, setBadge] = useState(section.badge ?? '');
  const [ctaLabel, setCtaLabel] = useState(section.ctaLabel ?? '');
  const [ctaHref, setCtaHref] = useState(section.ctaHref ?? '');
  const [ctaSecondaryLabel, setCtaSecondaryLabel] = useState(
    section.ctaSecondaryLabel ?? ''
  );
  const [ctaSecondaryHref, setCtaSecondaryHref] = useState(
    section.ctaSecondaryHref ?? ''
  );
  const [imageUrl, setImageUrl] = useState(section.imageUrl ?? '');
  // Editable copy of the section's `config` JSON. Casts are confined
  // to the per-type editors below, which know which keys to expect.
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => ({ ...section.config })
  );

  const showSecondary = section.type === 'HERO';
  const showBadge = section.type === 'HERO';
  const showImage = section.type === 'HERO' || section.type === 'BECOME_SUPPLIER';

  function patchConfig(partial: Record<string, unknown>) {
    setConfig((prev) => ({ ...prev, ...partial }));
  }

  function submit() {
    onSave({
      title,
      subtitle: subtitle || null,
      ctaLabel: ctaLabel || null,
      ctaHref: ctaHref || null,
      ctaSecondaryLabel: showSecondary ? ctaSecondaryLabel || null : null,
      ctaSecondaryHref: showSecondary ? ctaSecondaryHref || null : null,
      badge: showBadge ? badge || null : null,
      imageUrl: showImage ? imageUrl || null : null,
      config
    } as Partial<HomepageSectionDTO>);
  }

  return (
    <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-2">
      <Field label="Title" full>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          maxLength={200}
        />
      </Field>

      <Field label="Subtitle" full>
        <textarea
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={2}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          maxLength={1000}
        />
      </Field>

      {showBadge && (
        <Field label="Badge text">
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Direct from UAE suppliers"
            className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
            maxLength={100}
          />
        </Field>
      )}

      {showImage && (
        <div className="sm:col-span-2">
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            label="Section image"
            hint={
              section.type === 'HERO'
                ? 'Optional hero image. Leave empty to use the default glass-card visual.'
                : 'Optional banner image shown next to the supplier copy.'
            }
            aspectRatio="wide"
          />
        </div>
      )}

      <Field label="Primary CTA label">
        <input
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          maxLength={100}
        />
      </Field>
      <Field label="Primary CTA href" hint="Use a path like /products or full URL">
        <input
          value={ctaHref}
          onChange={(e) => setCtaHref(e.target.value)}
          placeholder="/products"
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          maxLength={500}
        />
      </Field>

      {showSecondary && (
        <>
          <Field label="Secondary CTA label">
            <input
              value={ctaSecondaryLabel}
              onChange={(e) => setCtaSecondaryLabel(e.target.value)}
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
              maxLength={100}
            />
          </Field>
          <Field label="Secondary CTA href">
            <input
              value={ctaSecondaryHref}
              onChange={(e) => setCtaSecondaryHref(e.target.value)}
              placeholder="/contact?type=quote"
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
              maxLength={500}
            />
          </Field>
        </>
      )}

      <ConfigEditor
        section={section}
        config={config}
        onPatch={patchConfig}
      />

      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !title.trim()}
          onClick={submit}
          className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-type config editor                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dispatcher that picks the right config editor based on `section.type`.
 * Each editor is fully self-contained (manages its own draft / expand
 * state) and reports changes via `onPatch` so the parent only stores
 * the merged JSON object that ships to the API.
 *
 * Defensive casts keep the `config` blob loosely-typed at the boundary
 * while still giving each editor a strongly-typed view of its slice.
 */
function ConfigEditor({
  section,
  config,
  onPatch
}: {
  section: HomepageSectionDTO;
  config: Record<string, unknown>;
  onPatch: (partial: Record<string, unknown>) => void;
}) {
  switch (section.type) {
    case 'HERO': {
      const chips = asStringArray(config.chips);
      return (
        <div className="sm:col-span-2">
          <StringListEditor
            label="Hero chips"
            hint="Short trust badges shown under the CTAs (e.g. Verified suppliers)."
            placeholder="Add a chip and press Enter"
            max={5}
            values={chips}
            onChange={(next) => onPatch({ chips: next })}
          />
        </div>
      );
    }

    case 'BECOME_SUPPLIER': {
      const benefits = asStringArray(config.benefits);
      return (
        <div className="sm:col-span-2">
          <StringListEditor
            label="Supplier benefits"
            hint="Bulleted list shown under the headline."
            placeholder="Add a benefit and press Enter"
            max={6}
            values={benefits}
            onChange={(next) => onPatch({ benefits: next })}
          />
        </div>
      );
    }

    case 'TRUST': {
      const items = asObjectArray<{
        title: string;
        description: string;
        icon?: string;
      }>(config.items, (it) =>
        typeof it.title === 'string' && typeof it.description === 'string'
      );
      return (
        <TrustItemsEditor
          values={items}
          onChange={(next) => onPatch({ items: next })}
        />
      );
    }

    case 'GLOBAL_SHOPPING': {
      const cards = asObjectArray<{
        title: string;
        description: string;
        ctaLabel?: string;
        ctaHref?: string;
        icon?: string;
        accent?: string;
      }>(config.cards, (c) =>
        typeof c.title === 'string' && typeof c.description === 'string'
      );
      return (
        <CardsEditor
          values={cards}
          onChange={(next) => onPatch({ cards: next })}
        />
      );
    }

    case 'AUCTION': {
      const items = asObjectArray<{
        title: string;
        imageUrl?: string;
        currentBid: number;
        currency?: string;
        endsAt?: string;
        href?: string;
      }>(config.items, (it) =>
        typeof it.title === 'string' && typeof it.currentBid === 'number'
      );
      return (
        <AuctionItemsEditor
          values={items}
          onChange={(next) => onPatch({ items: next })}
        />
      );
    }

    case 'CATEGORIES':
      return (
        <>
          <LimitField
            label="Categories settings"
            hint="When no categories are pinned, the grid auto-loads the most-populated ones."
            value={Number(config.limit) || 8}
            min={2}
            max={12}
            defaultValue={8}
            onChange={(n) => onPatch({ limit: n })}
          />
          <ItemPicker
            entity="category"
            label="Pinned categories"
            hint="Optional curated list. Order is preserved on the storefront."
            max={12}
            value={asIdArray(config.categoryIds)}
            onChange={(next) => onPatch({ categoryIds: next })}
          />
        </>
      );

    case 'FEATURED_PRODUCTS':
      return (
        <>
          <LimitField
            label="Featured products settings"
            hint="Auto-loads the latest products when no products are pinned."
            value={Number(config.limit) || 8}
            min={4}
            max={16}
            defaultValue={8}
            onChange={(n) => onPatch({ limit: n })}
          />
          <ItemPicker
            entity="product"
            label="Pinned products"
            hint="Hand-picked items shown in this exact order."
            max={16}
            value={asIdArray(config.productIds)}
            onChange={(next) => onPatch({ productIds: next })}
          />
        </>
      );

    case 'TOP_SUPPLIERS':
      return (
        <>
          <LimitField
            label="Top suppliers settings"
            hint="Auto-ranks verified suppliers by product count when none are pinned."
            value={Number(config.limit) || 6}
            min={3}
            max={12}
            defaultValue={6}
            onChange={(n) => onPatch({ limit: n })}
          />
          <ItemPicker
            entity="supplier"
            label="Pinned suppliers"
            hint="Bypasses the auto-ranking and shows exactly these suppliers."
            max={12}
            value={asIdArray(config.supplierIds)}
            onChange={(next) => onPatch({ supplierIds: next })}
          />
        </>
      );

    case 'BLOG':
      return (
        <>
          <LimitField
            label="Blog settings"
            hint="Auto-loads the latest published posts when none are pinned."
            value={Number(config.limit) || 3}
            min={2}
            max={6}
            defaultValue={3}
            onChange={(n) => onPatch({ limit: n })}
          />
          <ItemPicker
            entity="post"
            label="Pinned posts"
            hint="Drafts are filtered out automatically."
            max={6}
            value={asIdArray(config.postIds)}
            onChange={(next) => onPatch({ postIds: next })}
          />
        </>
      );

    default:
      return null;
  }
}

/** Coerce JSON value to a string[] of IDs (cuids). Drops anything
 *  that isn't a non-empty string so a malformed config can't crash
 *  the picker. */
function asIdArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  );
}

/** Coerce an unknown JSON value into a string[]. Drops anything that
 *  isn't a non-empty string, but preserves order. */
function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
}

/** Coerce an unknown JSON value into a typed object[] using a guard.
 *  Bad rows are dropped silently — admins simply re-add them. */
function asObjectArray<T extends Record<string, unknown>>(
  raw: unknown,
  guard: (it: T) => boolean
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (it): it is T => !!it && typeof it === 'object' && guard(it as T)
  ) as T[];
}

/* -------------------------------------------------------------------------- */
/* Action menus                                                               */
/* -------------------------------------------------------------------------- */

/**
 * "+ Add section" dropdown anchored at the top of the manager. Lists
 * every supported section type so admins can stage as many copies as
 * they want — duplicates are intentional.
 */
function AddSectionMenu({
  onAdd
}: {
  onAdd: (type: HomepageSectionDTO['type']) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const types = Object.keys(TYPE_LABELS) as Array<HomepageSectionDTO['type']>;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-orange-500 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
      >
        + Add section
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute end-0 z-30 mt-2 w-56 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5"
        >
          {types.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAdd(t);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
              >
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[t]}`}
                >
                  {TYPE_LABELS[t].slice(0, 3)}
                </span>
                <span className="flex-1 truncate">{TYPE_LABELS[t]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Per-row "..." dropdown for non-primary actions (duplicate, delete).
 * Kept tiny on purpose — the most common admin actions (toggle, edit,
 * reorder) all have explicit affordances on the row itself.
 */
function RowMenu({
  onDuplicate,
  onDelete,
  disabled
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute end-0 z-30 mt-1 w-40 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5"
        >
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
              Duplicate
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
              </svg>
              Delete
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                            */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  full,
  children
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      } disabled:opacity-60`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function DragIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
