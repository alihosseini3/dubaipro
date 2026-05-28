import Link from 'next/link';

import { PriceView } from '@/components/currency/PriceView';
import type { TopProduct } from '@/lib/analytics/types';
import type { DisplayCurrency } from '@/types/currency';

type Props = {
  items: TopProduct[];
  locale: string;
  display: DisplayCurrency;
  emptyLabel: string;
  unitsLabel: (count: number) => string;
};

/**
 * Leaderboard of best-selling products with an inline bar chart. Revenue
 * comes in AED and is converted per-row by `PriceView`, keeping the
 * aggregate layer oblivious to UI currency.
 */
export function TopProductsList({
  items,
  locale,
  display,
  emptyLabel,
  unitsLabel
}: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.revenue), 1);

  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const pct = (item.revenue / max) * 100;
        return (
          <li
            key={item.productId}
            className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3 transition-all duration-200 hover:border-slate-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)]"
          >
            {/* Bar behind the content */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-50 to-transparent transition-all duration-500"
              style={{ width: `${pct}%` }}
              aria-hidden
            />

            <div className="relative flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-slate-400">
                {idx + 1}
              </span>
              <Link
                href={`/${locale}/products/${item.slug}`}
                className="min-w-0 flex-1 text-sm font-medium text-slate-900 hover:underline"
              >
                <span className="block truncate">{item.title}</span>
                <span className="block text-[11px] font-normal text-slate-500">
                  {unitsLabel(item.unitsSold)}
                </span>
              </Link>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                <PriceView amount={item.revenue} display={display} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
