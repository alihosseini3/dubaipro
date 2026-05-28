import { PriceView } from '@/components/currency/PriceView';
import type { TopCoupon } from '@/lib/analytics/types';
import type { DisplayCurrency } from '@/types/currency';

type Props = {
  items: TopCoupon[];
  display: DisplayCurrency;
  emptyLabel: string;
  usesLabel: (count: number) => string;
};

/** Coupon leaderboard — counts uses and total discount given (AED). */
export function TopCouponsList({
  items,
  display,
  emptyLabel,
  usesLabel
}: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.uses), 1);

  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const pct = (item.uses / max) * 100;
        return (
          <li
            key={item.code}
            className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3 transition-all duration-200 hover:border-slate-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)]"
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-50 to-transparent transition-all duration-500"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-slate-400">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <code className="block truncate font-mono text-sm font-semibold text-slate-900">
                  {item.code}
                </code>
                <span className="block text-[11px] font-normal text-slate-500">
                  {usesLabel(item.uses)}
                </span>
              </div>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                <span className="text-rose-600">−</span>{' '}
                <PriceView amount={item.totalDiscount} display={display} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
