type StatusBadgeProps = {
  status: string;
  variant?: 'rfq' | 'order' | 'bool' | 'role' | 'neutral';
  dot?: boolean;
};

type Palette = { bg: string; text: string; dot: string };

const PALETTE: Record<string, Palette> = {
  OPEN:        { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  REVIEWING:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  QUOTED:      { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  ACCEPTED:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED:    { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500' },
  CLOSED:      { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  PENDING:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  PAID:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PROCESSING:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  SHIPPED:     { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  DELIVERED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED:   { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
  DRAFT:       { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  SCHEDULED:   { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  SENDING:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  COMPLETED:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  ADMIN:       { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  SUPPLIER:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  SELLER:      { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  CUSTOMER:    { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  TRUE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  FALSE:       { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-300' },
};

const FALLBACK: Palette = { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

export function StatusBadge({ status, variant = 'neutral', dot = true }: StatusBadgeProps) {
  const key = status.toUpperCase();
  const p = PALETTE[key] ?? FALLBACK;
  return (
    <span
      data-variant={variant}
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
        p.bg,
        p.text,
      ].join(' ')}
    >
      {dot && <span className={`h-1.5 w-1.5 flex-none rounded-full ${p.dot}`} />}
      {status}
    </span>
  );
}
