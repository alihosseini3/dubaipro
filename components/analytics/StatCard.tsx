import type { ReactNode } from 'react';

type Props = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'emerald' | 'sky' | 'violet' | 'amber';
};

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100'
};

/**
 * Stripe/Shopify-style KPI card. Renders label + hero value + optional
 * delta/hint line, with a soft accent square for visual rhythm.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'emerald'
}: Props) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-2 truncate text-2xl font-semibold tabular-nums text-slate-900">
            {value}
          </div>
          {hint ? (
            <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
          ) : null}
        </div>
        {icon ? (
          <div
            className={
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 ' +
              ACCENT[accent]
            }
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
