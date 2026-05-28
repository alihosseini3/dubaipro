import Link from 'next/link';

import type { AuctionDTO } from '@/lib/auctions/service';

type Props = {
  auctions: AuctionDTO[];
  locale:   string;
  title:    string;
  emptyLabel?: string;
};

/**
 * Server-rendered carousel of related auction cards. Designed to sit
 * below the main detail panel and match the visual weight of
 * `RelatedProducts` on the product page.
 */
export function RelatedAuctions({ auctions, locale, title, emptyLabel }: Props) {
  if (auctions.length === 0) {
    if (!emptyLabel) return null;
    return (
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
        {auctions.map((a) => (
          <Link
            key={a.id}
            href={`/${locale}/auctions/${a.slug}`}
            className="group block w-60 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg sm:w-auto"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              {a.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={a.imageUrl} alt={a.title} loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </div>
              )}
              {a.status === 'LIVE' && (
                <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </span>
              )}
            </div>
            <div className="space-y-1 p-3">
              <h3 className="line-clamp-2 min-h-[36px] text-xs font-semibold leading-tight text-slate-900 transition group-hover:text-[#F97316]">
                {a.title}
              </h3>
              <p className="text-[15px] font-black tabular-nums text-[#F97316]">
                {new Intl.NumberFormat(locale, {
                  style: 'currency', currency: a.currency, maximumFractionDigits: 0,
                }).format(a.currentBid > 0 ? a.currentBid : a.startingBid)}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{a.bidCount} {a.bidCount === 1 ? 'bid' : 'bids'}</span>
                <span>{a.watcherCount} watching</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
