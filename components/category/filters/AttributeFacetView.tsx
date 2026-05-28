'use client';

import { useTranslations } from 'next-intl';

import type { AttributeFacet } from '@/lib/categories/filter';

import { CheckboxRow, ColorSwatchRow, Section, ICONS } from './adapters';
import { FacetList } from './FacetList';
import { RangeSlider } from './RangeSlider';

/**
 * Per-attribute facet renderer. Picks the right UI adapter from the
 * attribute `type` so one dispatch table covers every admin-defined
 * filterable attribute in the catalog.
 *
 * Adapters:
 *   `select`  → searchable checkbox list (with counts)
 *   `color`   → colour swatch grid with counts
 *   `boolean` → single "Yes / No" toggle row
 *   `number`  → range slider + paired numeric inputs
 */

type Props = {
  attr: AttributeFacet;
  title: string;
  selected: string[];
  numberRange: [number, number] | null;
  onToggle: (value: string, checked: boolean) => void;
  onRangeCommit: (range: [number, number] | null) => void;
};

export function AttributeFacetView({
  attr,
  title,
  selected,
  numberRange,
  onToggle,
  onRangeCommit,
}: Props) {
  const t = useTranslations('filters');
  const badge = attr.type === 'number' ? (numberRange ? 1 : 0) : selected.length;
  const defaultOpen = badge > 0;

  if (attr.type === 'number') {
    if (!attr.range) return null;
    const { min, max } = attr.range;
    const current: [number, number] = numberRange ?? [min, max];
    return (
      <Section title={title} iconPath={ICONS.spark} defaultOpen={defaultOpen} badge={badge}>
        <RangeSlider
          min={min}
          max={max}
          step={1}
          value={current}
          onCommit={(next) => {
            // Drop the filter when the user drags the handles back to the
            // full range — no reason to keep a no-op in the URL.
            if (next[0] <= min && next[1] >= max) onRangeCommit(null);
            else onRangeCommit(next);
          }}
          unit={attr.unit}
          minAriaLabel={t('from')}
          maxAriaLabel={t('to')}
          applyLabel={t('applyFilters')}
        />
      </Section>
    );
  }

  if (attr.type === 'boolean') {
    // Boolean attrs only have two possible states — show a single toggle
    // row that maps to the canonical "true" value. We respect admin-
    // supplied `options` when present (e.g. "Yes" / "No") else default.
    const trueValue = attr.options?.[0] ?? 'true';
    const count = attr.values.find((v) => v.value === trueValue)?.count ?? 0;
    return (
      <Section title={title} iconPath={ICONS.avail} defaultOpen={defaultOpen} badge={badge}>
        <CheckboxRow
          id={`attr-${attr.slug}-yes`}
          label={trueValue}
          count={count}
          checked={selected.includes(trueValue)}
          onChange={(v) => onToggle(trueValue, v)}
        />
      </Section>
    );
  }

  if (attr.type === 'color') {
    return (
      <Section title={title} iconPath={ICONS.tag} defaultOpen={defaultOpen} badge={badge}>
        <div className="grid grid-cols-1 gap-0.5">
          {attr.values.map(({ value, count }) => (
            <ColorSwatchRow
              key={value}
              id={`attr-${attr.slug}-${value}`}
              value={value}
              count={count}
              checked={selected.includes(value)}
              disabled={count === 0 && !selected.includes(value)}
              onChange={(v) => onToggle(value, v)}
            />
          ))}
        </div>
      </Section>
    );
  }

  // Default: select (chip list with search + show-more).
  const items = attr.values.map(({ value, count }) => ({ id: value, name: value, count }));
  return (
    <Section title={title} iconPath={ICONS.brand} defaultOpen={defaultOpen} badge={badge}>
      <FacetList
        items={items}
        maxVisible={8}
        selectedIds={selected}
        onToggle={onToggle}
        searchLabel={t('searchPlaceholder')}
        showMoreLabel={t('showMore')}
        showLessLabel={t('showLess')}
      />
    </Section>
  );
}
