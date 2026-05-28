'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import type { AuctionDTO, AuctionDetailDTO } from '@/lib/auctions/service';

import { ImageField } from '@/components/admin/builder/ImageField';
import { GalleryPicker } from './GalleryPicker';
import { SingleEntityPicker } from './SingleEntityPicker';

type Props = {
  initial: AuctionDTO[];
  /** Optional preloaded gallery state per auction (when admin edits a single lot). */
  galleries?: Record<string, string[]>;
};

/** Extended payload type — includes fields not in AuctionDTO (gallery, reserve). */
type FormPayload = Partial<AuctionDTO> & {
  reservePrice?: number | null;
  galleryUrls?: string[];
  categoryId?: string | null;
  supplierId?: string | null;
};

const STATUS_COLORS: Record<AuctionDTO['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-sky-100 text-sky-700',
  LIVE: 'bg-emerald-100 text-emerald-700',
  ENDED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-700'
};

const STATUS_LABELS: Record<AuctionDTO['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  LIVE: 'Live',
  ENDED: 'Ended',
  CANCELLED: 'Cancelled'
};

/**
 * Admin auctions manager. Same UX skeleton as `SectionsManager` (drag/drop
 * reorder, inline edit, optimistic delete) but tailored to auction
 * fields:
 *
 *   - `startsAt` / `endsAt` rendered as `datetime-local` inputs that
 *     round-trip through ISO 8601 so the storage stays UTC.
 *   - `imageUrl` reuses the homepage `ImageUploader` so the upload
 *     pipeline (POST /api/upload) is shared.
 *   - Status is admin-controlled — service layer auto-resolves SCHEDULED
 *     vs. LIVE vs. ENDED at render time, but admins can still force
 *     DRAFT / CANCELLED.
 */
export function AuctionsManager({ initial, galleries = {} }: Props) {
  const t  = useTranslations('adminAuctions');
  const tf = useTranslations('adminAuctions.form');
  const ts = useTranslations('auctions.status');
  const router = useRouter();
  const [items, setItems] = useState<AuctionDTO[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
      const res = await fetch('/api/admin/auctions/reorder', {
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

  async function saveEdit(id: string, payload: FormPayload) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/auctions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('save_failed');
      const json = (await res.json()) as { data: AuctionDTO };
      setItems((prev) => prev.map((x) => (x.id === id ? json.data : x)));
      setEditingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError(tf('saveFailed'));
    } finally {
      setPendingId(null);
    }
  }

  async function createNew(payload: FormPayload) {
    setError(null);
    try {
      const res = await fetch('/api/admin/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'create_failed');
      }
      const json = (await res.json()) as { data: AuctionDTO };
      setItems((prev) => [...prev, json.data]);
      setAdding(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(tf('createFailed', { error: (e as Error).message }));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(tf('deleteConfirm'))) return;
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/auctions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) setEditingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError(tf('deleteFailed'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {t('lotsCount', { count: items.length })} ·{' '}
          {t('liveCount', { count: items.filter((x) => x.status === 'LIVE').length })} ·{' '}
          {t('scheduledCount', { count: items.filter((x) => x.status === 'SCHEDULED').length })}
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#F97316] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
        >
          + {t('newAuction')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {adding && (
        <AuctionForm
          mode="create"
          onSubmit={createNew}
          onCancel={() => setAdding(false)}
          saving={false}
          tf={tf}
          ts={ts}
        />
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
                overId === item.id
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200'
              } ${pendingId === item.id ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="cursor-grab text-slate-400" aria-label="Drag handle">
                  <DragIcon />
                </span>

                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-400 ring-1 ring-slate-200">
                    No img
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.title || <em className="text-slate-400">Untitled</em>}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    /{item.slug} · {item.bidCount} {item.bidCount === 1 ? 'bid' : 'bids'} · {new Date(item.endsAt).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    STATUS_COLORS[item.status]
                  }`}
                >
                  {ts(item.status)}
                </span>

                <span className="shrink-0 whitespace-nowrap text-sm font-bold text-slate-900">
                  {item.currentBid > 0 ? item.currentBid : item.startingBid}{' '}
                  <span className="text-[10px] font-medium text-slate-500">
                    {item.currency}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setEditingId(expanded ? null : item.id)}
                  className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {expanded ? tf('close') : tf('edit')}
                </button>

                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  disabled={pendingId === item.id}
                  className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                >
                  {tf('delete')}
                </button>
              </div>

              {expanded && (
                <AuctionForm
                  mode="edit"
                  initial={item}
                  initialGallery={galleries[item.id] ?? []}
                  onSubmit={(payload) => void saveEdit(item.id, payload)}
                  onCancel={() => setEditingId(null)}
                  saving={pendingId === item.id}
                  tf={tf}
                  ts={ts}
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
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

const STATUSES: AuctionDTO['status'][] = [
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'ENDED',
  'CANCELLED'
];

type Translator = ReturnType<typeof useTranslations>;

function AuctionForm({
  mode,
  initial,
  initialGallery = [],
  onSubmit,
  onCancel,
  saving,
  tf,
  ts,
}: {
  mode: 'create' | 'edit';
  initial?: AuctionDTO;
  initialGallery?: string[];
  onSubmit: (payload: FormPayload) => void;
  onCancel: () => void;
  saving: boolean;
  tf: Translator;
  ts: Translator;
}) {
  const [slug, setSlug]                 = useState(initial?.slug ?? '');
  const [title, setTitle]               = useState(initial?.title ?? '');
  const [description, setDescription]   = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl]         = useState(initial?.imageUrl ?? '');
  const [galleryUrls, setGalleryUrls]   = useState<string[]>(initialGallery);
  const [startingBid, setStartingBid]   = useState(initial?.startingBid ?? 100);
  const [reservePrice, setReservePrice] = useState<number | ''>(initial?.reservePrice ?? '');
  const [minIncrement, setMinIncrement] = useState(initial?.minIncrement ?? 10);
  const [currency, setCurrency]         = useState(initial?.currency ?? 'AED');
  const [supplierId, setSupplierId]     = useState<string | null>(initial?.supplierId ?? null);
  const [categoryId, setCategoryId]     = useState<string | null>(initial?.categoryId ?? null);
  const [startsAt, setStartsAt]         = useState(
    initial?.startsAt ? toLocalInput(initial.startsAt) : toLocalInput(new Date().toISOString())
  );
  const [endsAt, setEndsAt]             = useState(
    initial?.endsAt ? toLocalInput(initial.endsAt) : toLocalInput(new Date(Date.now() + 7 * 86_400_000).toISOString())
  );
  const [status, setStatus] = useState<AuctionDTO['status']>(initial?.status ?? 'DRAFT');

  function submit() {
    onSubmit({
      slug: slug.trim(),
      title: title.trim(),
      description,
      imageUrl: imageUrl || null,
      galleryUrls,
      startingBid: Number(startingBid),
      reservePrice: reservePrice === '' ? null : Number(reservePrice),
      minIncrement: Number(minIncrement),
      currency,
      supplierId,
      categoryId,
      startsAt: new Date(startsAt).toISOString() as unknown as AuctionDTO['startsAt'],
      endsAt:   new Date(endsAt).toISOString()   as unknown as AuctionDTO['endsAt'],
      status,
    });
  }

  return (
    <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-2">
      <Field label={tf('title')} full>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('slug')} hint={tf('slugHint')}>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={120}
          placeholder="oem-laptops-batch-12"
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('status')}>
        <select value={status} onChange={(e) => setStatus(e.target.value as AuctionDTO['status'])}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300">
          {STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
        </select>
      </Field>

      <Field label={tf('description')} full>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={5000}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      {/* Hero image — single picker via Media Library */}
      <div className="sm:col-span-2">
        <ImageField
          label={tf('heroImage')}
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="https://…"
        />
      </div>

      {/* Gallery — multi picker via Media Library */}
      <div className="sm:col-span-2">
        <GalleryPicker
          label={tf('gallery')}
          hint={tf('galleryHint')}
          addLabel={tf('addFromLibrary')}
          removeLabel={tf('removeImage')}
          value={galleryUrls}
          onChange={setGalleryUrls}
          max={12}
        />
      </div>

      {/* Category + supplier pickers */}
      <SingleEntityPicker
        entity="category"
        value={categoryId}
        onChange={setCategoryId}
        label={tf('category')}
        placeholder={tf('selectCategory')}
        noneLabel={tf('categoryNone')}
      />
      <SingleEntityPicker
        entity="supplier"
        value={supplierId}
        onChange={setSupplierId}
        label={tf('supplier')}
        placeholder={tf('selectSupplier')}
        noneLabel={tf('supplierNone')}
        verifiedLabel={tf('supplierVerified')}
      />

      <Field label={tf('startingBid')}>
        <input type="number" value={startingBid} min={0} step={1}
          onChange={(e) => setStartingBid(Number(e.target.value) || 0)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('reservePrice')} hint={tf('reservePriceHint')}>
        <input type="number" value={reservePrice} min={0} step={1}
          onChange={(e) => setReservePrice(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="—"
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('minIncrement')}>
        <input type="number" value={minIncrement} min={0} step={1}
          onChange={(e) => setMinIncrement(Number(e.target.value) || 0)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('currency')}>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300">
          <option value="AED">AED</option>
          <option value="USD">USD</option>
          <option value="IRR">IRR</option>
        </select>
      </Field>

      <Field label={tf('startsAt')}>
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <Field label={tf('endsAt')}>
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
          className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300" />
      </Field>

      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          {tf('cancel')}
        </button>
        <button type="button" disabled={saving || !title.trim() || !slug.trim()} onClick={submit}
          className="inline-flex h-9 items-center rounded-md bg-[#F97316] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60">
          {saving ? tf('saving') : mode === 'create' ? tf('create') : tf('save')}
        </button>
      </div>
    </div>
  );
}

/* -------- Helpers -------- */

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
      {hint && (
        <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>
      )}
    </label>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
