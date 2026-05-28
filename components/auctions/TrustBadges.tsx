import { useTranslations } from 'next-intl';

type Props = {
  supplierVerified: boolean;
  supplierCountry?: string | null;
};

/**
 * Trust badge row shown on the auction detail page beneath the gallery.
 * Mirrors the language and visual weight of the product detail trust
 * row so buyers feel the same level of safety on auctions.
 */
export function AuctionTrustBadges({ supplierVerified, supplierCountry }: Props) {
  const t = useTranslations('auctions.detail.trust');

  const items = [
    supplierVerified && {
      key: 'verified',
      icon: <BadgeIcon />,
      label: t('verified'),
      tone: 'emerald',
    },
    {
      key: 'secure',
      icon: <ShieldIcon />,
      label: t('secure'),
      tone: 'sky',
    },
    {
      key: 'antiSnipe',
      icon: <BoltIcon />,
      label: t('antiSnipe'),
      tone: 'orange',
    },
    supplierCountry && {
      key: 'shipsFrom',
      icon: <TruckIcon />,
      label: t('shipsFrom', { country: supplierCountry }),
      tone: 'slate',
    },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; tone: string }[];

  const toneCls: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sky:     'border-sky-200 bg-sky-50 text-sky-700',
    orange:  'border-orange-200 bg-orange-50 text-orange-700',
    slate:   'border-slate-200 bg-slate-50 text-slate-700',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <div
          key={it.key}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold ${toneCls[it.tone]}`}
        >
          {it.icon}
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
