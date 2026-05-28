import type { SupplierTier } from '@prisma/client';

const IconShield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
    <path d="M8 0L1 3v5c0 4 3 7 7 8 4-1 7-4 7-8V3L8 0zm-1 11L3.5 7.5l1-1L7 9l4.5-4.5 1 1L7 11z" />
  </svg>
);
const IconSparkle = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
    <path d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12 6.4 7.6 2 6l4.4-1.6L8 0zm5 9l.7 1.8L15.5 11.5l-1.8.7L13 14l-.7-1.8L10.5 11.5l1.8-.7L13 9z" />
  </svg>
);
const IconStar = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
    <path d="M8 1l2.2 4.5 5 .7-3.6 3.5.9 5L8 12.4 3.5 14.7l.9-5L.8 6.2l5-.7L8 1z" />
  </svg>
);

type Props = {
  tier: SupplierTier;
  /** Compact = icon-only with tooltip; Full = icon + label. */
  compact?: boolean;
  className?: string;
  labels: {
    standard?: string;
    verified: string;
    guaranteed: string;
  };
};

/**
 * Trust-tier badge — color-coded chip used on cards and the profile hero.
 * STANDARD intentionally renders nothing in compact mode (no badge clutter
 * for un-verified suppliers).
 */
export function SupplierTierBadge({ tier, compact, className, labels }: Props) {
  if (tier === 'STANDARD') {
    if (compact) return null;
    return labels.standard ? (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ${className ?? ''}`}
      >
        <IconStar className="h-3 w-3" />
        {labels.standard}
      </span>
    ) : null;
  }

  if (tier === 'VERIFIED') {
    return (
      <span
        title={labels.verified}
        className={`inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200 ${className ?? ''}`}
      >
        <IconShield className="h-3 w-3" />
        {!compact && labels.verified}
      </span>
    );
  }

  return (
    <span
      title={labels.guaranteed}
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-300 ${className ?? ''}`}
    >
      <IconSparkle className="h-3 w-3" />
      {!compact && labels.guaranteed}
    </span>
  );
}
