'use client';

import { SectionWrap, SmallField } from './TrustItemsEditor';

type Props = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (n: number) => void;
};

/**
 * Single-number config field used by sections that auto-load a list
 * (CATEGORIES, FEATURED_PRODUCTS, TOP_SUPPLIERS, BLOG). The renderer
 * already clamps to `[min, max]` defensively, but we expose them as
 * native input attributes so the browser hint matches.
 */
export function LimitField({
  label,
  hint,
  value,
  min,
  max,
  defaultValue,
  onChange
}: Props) {
  return (
    <SectionWrap label={label}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SmallField label={`Items per row group (${min}–${max})`}>
          <input
            type="number"
            min={min}
            max={max}
            value={Number.isFinite(value) ? value : defaultValue}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              onChange(Math.max(min, Math.min(max, Math.floor(n))));
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          />
        </SmallField>
        {hint && (
          <p className="self-end pb-1.5 text-[11px] text-slate-500 sm:col-span-1">
            {hint}
          </p>
        )}
      </div>
    </SectionWrap>
  );
}
