'use client';

import { useState } from 'react';

import { ImageUploader } from './ImageUploader';
import {
  ItemActions,
  SectionWrap,
  SmallField
} from './TrustItemsEditor';

type Item = {
  title: string;
  imageUrl?: string;
  currentBid: number;
  currency?: string;
  endsAt?: string;
  href?: string;
};

type Props = {
  values: Item[];
  onChange: (next: Item[]) => void;
};

const MAX = 12;
const CURRENCIES = ['AED', 'USD', 'IRR'] as const;

/**
 * Editor for `AuctionConfig.items`. Each row collects the data needed
 * to render a live auction card — title, image, current bid, currency,
 * optional end timestamp (used by the live countdown), and a click
 * destination.
 *
 * `endsAt` is exposed as a `datetime-local` input so admins type a
 * local time; we round-trip via ISO 8601 so the renderer always sees
 * a stable UTC timestamp.
 */
export function AuctionItemsEditor({ values, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function patch(i: number, partial: Partial<Item>) {
    const next = values.slice();
    next[i] = { ...next[i], ...partial };
    onChange(next);
  }

  function add() {
    if (values.length >= MAX) return;
    const next = [
      ...values,
      { title: '', currentBid: 0, currency: 'AED' as string }
    ];
    onChange(next);
    setExpandedIdx(next.length - 1);
  }

  function removeAt(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
    if (expandedIdx === i) setExpandedIdx(null);
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= values.length) return;
    const next = values.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <SectionWrap label="Auction items" count={`${values.length}/${MAX}`}>
      <ul className="space-y-2">
        {values.map((item, i) => {
          const open = expandedIdx === i;
          return (
            <li key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="rounded-md bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-fuchsia-700">
                  {item.currency ?? 'AED'}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800">
                  {item.title || <em className="text-slate-400">Untitled lot</em>}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {Number.isFinite(item.currentBid) ? item.currentBid : 0}
                </span>
                <ItemActions
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  upDisabled={i === 0}
                  downDisabled={i >= values.length - 1}
                  onToggle={() => setExpandedIdx(open ? null : i)}
                  onRemove={() => removeAt(i)}
                  open={open}
                />
              </div>

              {open && (
                <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2">
                  <SmallField label="Title" full>
                    <input
                      value={item.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      maxLength={120}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <div className="sm:col-span-2">
                    <ImageUploader
                      value={item.imageUrl ?? ''}
                      onChange={(url) => patch(i, { imageUrl: url || undefined })}
                      label="Lot image"
                      aspectRatio="wide"
                    />
                  </div>
                  <SmallField label="Current bid">
                    <input
                      type="number"
                      value={Number.isFinite(item.currentBid) ? item.currentBid : ''}
                      onChange={(e) =>
                        patch(i, {
                          currentBid: Number(e.target.value) || 0
                        })
                      }
                      min={0}
                      step={1}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="Currency">
                    <select
                      value={item.currency ?? 'AED'}
                      onChange={(e) => patch(i, { currency: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </SmallField>
                  <SmallField label="Ends at (local time)">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(item.endsAt)}
                      onChange={(e) =>
                        patch(i, {
                          endsAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined
                        })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="Click destination (href)">
                    <input
                      value={item.href ?? ''}
                      onChange={(e) => patch(i, { href: e.target.value })}
                      placeholder="/auctions/<slug>"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {values.length < MAX && (
        <button
          type="button"
          onClick={add}
          className="mt-2 inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
        >
          + Add lot
        </button>
      )}
    </SectionWrap>
  );
}

/** ISO 8601 → `YYYY-MM-DDTHH:MM` (the format `<input type="datetime-local">`
 *  expects). Returns an empty string when input is missing/invalid so the
 *  field renders as cleared. */
function toDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
