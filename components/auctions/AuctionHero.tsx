import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { AuctionDetailDTO } from '@/lib/auctions/service';

import { HeroCountdown } from './HeroCountdown';

type Props = {
  auction:       AuctionDetailDTO;
  locale:        string;
  base:          string;
  supplierHref?: string;
  statusLabel:   string;
  breadcrumbHref: string;
};

const STATUS_BG: Record<string, string> = {
  LIVE:      'bg-emerald-500',
  SCHEDULED: 'bg-sky-500',
  ENDED:     'bg-slate-700',
  CANCELLED: 'bg-rose-500',
  DRAFT:     'bg-slate-500',
};

/**
 * Cinematic auction hero — full-bleed dark panel with the lot image
 * blurred out as a backdrop, glass overlay, dramatic title, supplier
 * verification, and a row of live activity chips designed to create
 * urgency (watching now / hot / ending soon).
 *
 * Server-rendered. Calculations like "bids in last hour" are a snapshot
 * at request time — the live panel handles realtime updates afterwards.
 */
export async function AuctionHero({
  auction,
  locale,
  base,
  supplierHref,
  statusLabel,
  breadcrumbHref,
}: Props) {
  const td = await getTranslations({ locale, namespace: 'auctions.detail' });
  const now = Date.now();

  const isLive = auction.status === 'LIVE';
  const msToEnd = new Date(auction.endsAt).getTime() - now;
  const isEndingSoon = isLive && msToEnd > 0 && msToEnd < 60 * 60 * 1000;
  const isHot = auction.bidCount >= 10 || auction.watcherCount >= 20;

  const oneHourAgo = now - 60 * 60 * 1000;
  const bidsLastHour = auction.recentBids.filter(
    (b) => new Date(b.createdAt).getTime() > oneHourAgo
  ).length;

  const heroImage = auction.imageUrl ?? auction.images[0]?.imageUrl ?? null;

  const categoryHref =
    auction.categoryName && auction.categorySlug
      ? `${base}/categories/${auction.categorySlug}`
      : null;

  const endsDiff = Math.max(0, new Date(auction.endsAt).getTime() - now);
  const initialParts = {
    days: Math.floor(endsDiff / 86_400_000),
    hours: Math.floor((endsDiff % 86_400_000) / 3_600_000),
    mins: Math.floor((endsDiff % 3_600_000) / 60_000),
    secs: Math.floor((endsDiff % 60_000) / 1_000),
    diff: endsDiff,
  };

  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl shadow-[0_18px_45px_rgba(2,6,23,0.22)] ring-1 ring-white/10">
      {/* ── Blurred backdrop image ── */}
      {heroImage && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt=""
            aria-hidden
            className="h-full w-full scale-125 object-cover blur-3xl brightness-50 saturate-150"
          />
        </div>
      )}

      {/* ── Gradient overlays for legibility ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020617]/95 via-[#0F172A]/88 to-slate-950/95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_35%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/90 via-transparent to-transparent" />
      {/* Subtle glow accents */}
      <div className="absolute -end-24 top-0 h-64 w-64 animate-pulse rounded-full bg-orange-500/15 blur-3xl" />
      <div className="absolute -start-24 bottom-0 h-64 w-64 rounded-full bg-emerald-500/12 blur-3xl" />

      {/* ── Content ── */}
      <div className="relative px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-white/55">
          <Link href={base} className="transition hover:text-white/80">
            {breadcrumbHref}
          </Link>
          <span className="text-white/25">/</span>
          <Link href={`${base}/auctions`} className="transition hover:text-white/80">
            {td('aboutLot')}
          </Link>
          {categoryHref && (
            <>
              <span className="text-white/25">/</span>
              <Link href={categoryHref} className="transition hover:text-white/80">
                {auction.categoryName}
              </Link>
            </>
          )}
        </nav>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* LEFT side: status pill + title + supplier */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md ${
                  STATUS_BG[auction.status] ?? 'bg-slate-500'
                }`}
              >
                {isLive && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                )}
                {statusLabel}
              </span>
              {auction.categoryName && categoryHref && (
                <Link
                  href={categoryHref}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
                >
                  {auction.categoryName}
                </Link>
              )}
            </div>

            <h1 className="max-w-3xl text-balance text-2xl font-black leading-tight tracking-tight text-white drop-shadow-2xl sm:text-3xl lg:text-[34px]">
              {auction.title}
            </h1>

            {auction.supplierName && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/75">
                <span>{td('soldBy')}</span>
                <Link href={supplierHref ?? '#'} className="font-semibold text-white transition hover:text-[#F97316]">
                  {auction.supplierName}
                </Link>
                {auction.supplierVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-200 ring-1 ring-amber-300/30">
                    <CheckIcon className="h-2.5 w-2.5" />
                    {td('trust.verified')}
                  </span>
                )}
                {auction.supplierCountry && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/55">
                    <GlobeIcon className="h-3 w-3" />
                    {auction.supplierCountry}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* RIGHT side: live countdown + chips */}
          <div className="flex flex-col items-stretch gap-2 lg:items-end">
            <HeroCountdown endsAt={auction.endsAt} initialParts={initialParts} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isEndingSoon && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow ring-1 ring-rose-400/40">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {td('endingSoon')}
                </span>
              )}
              {isHot && isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow ring-1 ring-orange-300/40">
                  <FlameIcon className="h-3 w-3" />
                  {td('hotAuction')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Activity strip ── */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {/* Watching now */}
          <span className="inline-flex items-center gap-1.5 text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <strong className="font-bold text-white">{auction.watcherCount}</strong>
            <span className="text-white/55">{td('watchingNow')}</span>
          </span>

          <span className="h-3 w-px bg-white/15" />

          {/* Total bids */}
          <span className="inline-flex items-center gap-1.5 text-white/80">
            <GavelIcon className="h-3.5 w-3.5 text-orange-300" />
            <strong className="font-bold text-white">{auction.bidCount}</strong>
            <span className="text-white/55">{td('bidsTotal')}</span>
          </span>

          {/* Bids last hour */}
          {bidsLastHour > 0 && (
            <>
              <span className="h-3 w-px bg-white/15" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-200 ring-1 ring-orange-400/25">
                <strong className="font-bold">{bidsLastHour}</strong>
                <span className="text-orange-200/80">{td('bidsLastHour')}</span>
              </span>
            </>
          )}

          <span className="h-3 w-px bg-white/15" />

          {/* Total views */}
          <span className="inline-flex items-center gap-1.5 text-white/55">
            <EyeIcon className="h-3.5 w-3.5" />
            <strong className="font-semibold text-white/80">
              {auction.totalViews.toLocaleString(locale)}
            </strong>
            <span>{td('viewsTotal')}</span>
          </span>

          {/* Ships from */}
          {auction.supplierCountry && (
            <>
              <span className="h-3 w-px bg-white/15" />
              <span className="inline-flex items-center gap-1.5 text-white/55">
                <TruckIcon className="h-3.5 w-3.5" />
                <span>{td('trust.shipsFrom', { country: auction.supplierCountry })}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────── Icons ───────── */

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c1 4 5 5 5 9 0 3-2 5-5 5s-5-2-5-5c0-2 1-3 2-4-1 0-3 1-3 4 0 4 3 7 6 7s6-3 6-7c0-5-4-7-6-9z" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function GavelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
      <path d="m16 16 6-6" />
      <path d="m8 8 6-6" />
      <path d="m9 7 8 8" />
      <path d="m21 11-8-8" />
    </svg>
  );
}
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}
