import type { ReactNode } from 'react';

type AdminCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminCard({
  title,
  description,
  actions,
  children,
  className,
}: AdminCardProps) {
  return (
    <section
      className={[
        'rounded-2xl border border-slate-200/80 bg-white shadow-sm',
        className ?? '',
      ].join(' ')}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

const STAT_ACCENTS = [
  { bg: 'bg-orange-500/10', icon: 'text-orange-500', bar: 'bg-orange-500' },
  { bg: 'bg-blue-500/10',   icon: 'text-blue-500',   bar: 'bg-blue-500' },
  { bg: 'bg-emerald-500/10',icon: 'text-emerald-500',bar: 'bg-emerald-500' },
  { bg: 'bg-violet-500/10', icon: 'text-violet-500', bar: 'bg-violet-500' },
  { bg: 'bg-amber-500/10',  icon: 'text-amber-500',  bar: 'bg-amber-500' },
];

type StatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  icon?: ReactNode;
  accentIndex?: number;
  trend?: { value: number; positive?: boolean };
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accentIndex = 0,
  trend,
}: StatCardProps) {
  const accent = STAT_ACCENTS[accentIndex % STAT_ACCENTS.length];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Accent bar */}
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent.bar} opacity-60`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-slate-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {hint && (
            <p className="mt-1.5 text-[12px] text-slate-500">{hint}</p>
          )}
          {trend && (
            <p
              className={[
                'mt-1.5 flex items-center gap-1 text-[12px] font-medium',
                trend.positive !== false ? 'text-emerald-600' : 'text-red-500',
              ].join(' ')}
            >
              <span>{trend.positive !== false ? '▲' : '▼'}</span>
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div
            className={[
              'flex h-10 w-10 flex-none items-center justify-center rounded-xl',
              accent.bg,
              accent.icon,
            ].join(' ')}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
