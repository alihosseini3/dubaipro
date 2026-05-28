'use client';

import { useState } from 'react';

import {
  ItemActions,
  SectionWrap,
  SmallField
} from './TrustItemsEditor';

type Card = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: string;
  accent?: string;
};

type Props = {
  values: Card[];
  onChange: (next: Card[]) => void;
};

const ICON_KEYS = [
  'cart',
  'package',
  'sparkle',
  'warehouse',
  'building',
  'tag'
] as const;
const ACCENT_KEYS = [
  'orange',
  'sky',
  'violet',
  'emerald',
  'rose',
  'amber'
] as const;

const MAX = 6;

/**
 * Editor for `GlobalShoppingConfig.cards`. One row per platform card
 * (Amazon UAE, Noon, Alibaba, …). Each row exposes title + description
 * plus optional CTA, icon key, and accent palette.
 */
export function CardsEditor({ values, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function patch(i: number, partial: Partial<Card>) {
    const next = values.slice();
    next[i] = { ...next[i], ...partial };
    onChange(next);
  }

  function add() {
    if (values.length >= MAX) return;
    const next = [
      ...values,
      {
        title: '',
        description: '',
        ctaLabel: 'Start order',
        ctaHref: '/contact?type=quote',
        icon: ICON_KEYS[values.length % ICON_KEYS.length],
        accent: ACCENT_KEYS[values.length % ACCENT_KEYS.length]
      }
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
    <SectionWrap label="Platform cards" count={`${values.length}/${MAX}`}>
      <ul className="space-y-2">
        {values.map((card, i) => {
          const open = expandedIdx === i;
          return (
            <li key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-700">
                  {card.icon ?? '—'}
                </span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                  {card.accent ?? '—'}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800">
                  {card.title || <em className="text-slate-400">Untitled card</em>}
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
                  <SmallField label="Title">
                    <input
                      value={card.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      maxLength={80}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="Icon">
                    <select
                      value={card.icon ?? 'cart'}
                      onChange={(e) => patch(i, { icon: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    >
                      {ICON_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </SmallField>
                  <SmallField label="Description" full>
                    <textarea
                      value={card.description}
                      onChange={(e) => patch(i, { description: e.target.value })}
                      rows={2}
                      maxLength={200}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="CTA label">
                    <input
                      value={card.ctaLabel ?? ''}
                      onChange={(e) => patch(i, { ctaLabel: e.target.value })}
                      maxLength={60}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="CTA href">
                    <input
                      value={card.ctaHref ?? ''}
                      onChange={(e) => patch(i, { ctaHref: e.target.value })}
                      placeholder="/contact?type=quote"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="Accent palette">
                    <select
                      value={card.accent ?? 'orange'}
                      onChange={(e) => patch(i, { accent: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    >
                      {ACCENT_KEYS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
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
          + Add card
        </button>
      )}
    </SectionWrap>
  );
}
