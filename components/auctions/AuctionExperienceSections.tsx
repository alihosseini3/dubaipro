import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ActiveBidsPanel } from '@/components/auctions/ActiveBidsPanel';
import type { AuctionDTO, AuctionDetailDTO } from '@/lib/auctions/service';

type TFn = (key: string, values?: Record<string, string | number>) => string;

type Props = {
  auction: AuctionDetailDTO;
  locale: string;
  loggedIn: boolean;
  loginHref: string;
  related: AuctionDTO[];
  supplierAuctions: AuctionDTO[];
  trending: AuctionDTO[];
};

function money(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function countryFlag(country?: string | null) {
  if (!country) return '🌐';
  const c = country.toLowerCase();
  if (c.includes('emirates') || c.includes('uae') || c.includes('dubai')) return '🇦🇪';
  if (c.includes('china')) return '🇨🇳';
  if (c.includes('india')) return '🇮🇳';
  if (c.includes('turkey')) return '🇹🇷';
  if (c.includes('germany')) return '🇩🇪';
  if (c.includes('usa') || c.includes('united states')) return '🇺🇸';
  return '🌐';
}

export async function AuctionExperienceSections({
  auction,
  locale,
  loggedIn,
  loginHref,
  related,
  supplierAuctions,
  trending,
}: Props) {
  const t = await getTranslations({ locale, namespace: 'auctions.detail' });
  const base = `/${locale}`;
  const carousel = [...related, ...supplierAuctions, ...trending]
    .filter((a, index, arr) => arr.findIndex((x) => x.id === a.id) === index)
    .slice(0, 10);

  return (
    <div className="mt-4 space-y-4">
      {/* Row 1: Description / Specifications / Supplier */}
      <section className="grid gap-4 lg:grid-cols-3">
        <DescriptionCard description={auction.description} t={t} />
        <SpecsCard auction={auction} locale={locale} t={t} />
        <SupplierCard auction={auction} base={base} t={t} />
      </section>

      {/* Row 2: Login (or my bids placeholder) + Recent bid activity */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <LoginCard loggedIn={loggedIn} loginHref={loginHref} t={t} />
        <ActiveBidsPanel auctionId={auction.id} locale={locale} loggedIn={loggedIn} loginHref={loginHref} />
      </section>

      {/* Trust strip */}
      <TrustStrip t={t} />

      {/* Related auctions carousel */}
      <RelatedCarousel auctions={carousel} locale={locale} title={t('related')} viewAllHref={`${base}/auctions`} t={t} />
    </div>
  );
}

function DescriptionCard({ description, t }: { description: string; t: TFn }) {
  const trimmed = description?.trim() || '';
  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const intro = lines[0] ?? t('noDescription');
  const bullets = lines.slice(1, 6);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t('itemDescription')}</p>
      <p className="mt-3 text-base leading-relaxed text-slate-700">{intro}</p>
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-base text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 6 && (
        <button type="button" className="mt-4 text-sm font-black text-[#F97316] underline-offset-4 hover:underline">
          {t('showMore')} ↓
        </button>
      )}
    </section>
  );
}

function SpecsCard({ auction, locale, t }: { auction: AuctionDetailDTO; locale: string; t: TFn }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: t('statusLabel'), value: auction.status },
    { label: t('categoryLabel'), value: auction.categoryName ?? '—' },
    { label: t('currencyLabel'), value: auction.currency },
    { label: t('startingBid'), value: money(auction.startingBid, auction.currency, locale) },
    { label: t('minIncrementLabel'), value: money(auction.minIncrement, auction.currency, locale) },
    { label: t('reserveLabel'), value: auction.reservePrice ? money(auction.reservePrice, auction.currency, locale) : t('noReserveLabel') },
    { label: t('shipsFromLabel'), value: auction.supplierCountry ?? '—' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t('specifications')}</p>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-2 gap-3 py-2 text-base">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="truncate text-end font-bold text-[#0F172A]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SupplierCard({ auction, base, t }: { auction: AuctionDetailDTO; base: string; t: TFn }) {
  const level = auction.supplierVerified
    ? auction.bidCount >= 10 || auction.watcherCount >= 20
      ? t('guaranteedSupplier')
      : t('trust.verified')
    : t('standardSupplier');
  const supplierHref = auction.supplierId ? `${base}/suppliers/${auction.supplierId}` : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t('supplierLabel')}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-lg font-black text-white shadow-md">
          {(auction.supplierName?.[0] ?? 'S').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#0F172A]">{auction.supplierName ?? t('trust.verified')}</p>
          {auction.supplierVerified && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
              ✓ {t('trust.verified')}
            </span>
          )}
        </div>
      </div>
      <dl className="mt-4 divide-y divide-slate-100 text-base">
        <Row label={t('supplierStatus')} value={level} valueClass="text-emerald-600" />
        {auction.supplierCountry && <Row label={t('countryLabel')} value={auction.supplierCountry} />}
        <Row label={t('auctionBids')} value={String(auction.bidCount)} />
        <Row label={t('watchers')} value={String(auction.watcherCount)} />
        <Row label={t('totalViews')} value={auction.totalViews.toLocaleString()} />
      </dl>
      {supplierHref && (
        <Link href={supplierHref} className="mt-4 block w-full rounded-xl bg-slate-900 py-2.5 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800">
          {t('viewStore')}
        </Link>
      )}
    </section>
  );
}

function LoginCard({ loggedIn, loginHref, t }: { loggedIn: boolean; loginHref: string; t: TFn }) {
  if (loggedIn) {
    return (
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">{t('loggedInLabel')}</p>
        <h3 className="mt-2 text-lg font-black text-[#0F172A]">{t('loggedInTitle')}</h3>
        <p className="mt-1 text-sm text-slate-600">{t('loggedInBody')}</p>
        <ul className="mt-4 grid gap-2 text-xs text-slate-700">
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('featureSecure')}</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('featureRealtime')}</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('featureEasy')}</li>
        </ul>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11v6M5 12V8a7 7 0 0114 0v4M4 12h16v9H4z" /></svg>
      </div>
      <h3 className="mt-3 text-base font-black text-[#0F172A]">{t('loginTitle')}</h3>
      <p className="mt-1 text-xs text-slate-500">{t('loginBody')}</p>
      <a href={loginHref} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#F97316] px-5 py-3 text-base font-black text-white shadow-[0_8px_18px_rgba(249,115,22,0.28)] transition hover:bg-orange-600">
        {t('loginButton')}
      </a>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
        <div className="rounded-xl bg-slate-50 p-2">{t('featureSecure')}</div>
        <div className="rounded-xl bg-slate-50 p-2">{t('featureRealtime')}</div>
        <div className="rounded-xl bg-slate-50 p-2">{t('featureEasy')}</div>
      </div>
    </section>
  );
}

function MyBidsCard({ auction, locale, loggedIn }: { auction: AuctionDetailDTO; locale: string; loggedIn: boolean }) {
  const items = auction.recentBids.slice(0, 3);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Recent bid activity</p>
          <span className="text-sm font-bold text-slate-400">View all →</span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-lg text-slate-500">
          {loggedIn ? 'No bids placed yet on this auction.' : 'Login to track your bidding activity here.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((bid, index) => (
            <li key={bid.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-base font-black text-white shadow-sm">
                {bid.bidderInitial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-[#0F172A]">{auction.title}</p>
                <p className="text-xs text-slate-500 tabular-nums">Bid {money(bid.amount, bid.currency, locale)} · {new Date(bid.createdAt).toLocaleDateString(locale)}</p>
              </div>
              {index === 0 ? (
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Leading</span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">Outbid</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrustStrip({ t }: { t: TFn }) {
  const items = [
    { icon: '🛡️', title: t('trustAntiSnipeTitle'), desc: t('trustAntiSnipeDesc') },
    { icon: '🔒', title: t('trustPaymentsTitle'), desc: t('trustPaymentsDesc') },
    { icon: '✅', title: t('trustSuppliersTitle'), desc: t('trustSuppliersDesc') },
    { icon: '🚚', title: t('trustShippingTitle'), desc: t('trustShippingDesc') },
  ];
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl">{item.icon}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#0F172A]">{item.title}</p>
            <p className="truncate text-xs text-slate-500">{item.desc}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function RelatedCarousel({ auctions, locale, title, viewAllHref, t }: { auctions: AuctionDTO[]; locale: string; title: string; viewAllHref: string; t: TFn }) {
  if (auctions.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-black uppercase tracking-[0.22em] text-[#0F172A]">{title || 'Related auctions'}</h2>
        <Link href={viewAllHref} className="text-sm font-bold text-[#F97316] hover:underline">{t('viewAllLink')} →</Link>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {auctions.slice(0, 10).map((a) => (
          <Link key={a.id} href={`/${locale}/auctions/${a.slug}`} className="group block w-44 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md lg:w-auto">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              {a.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={a.imageUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">{t('noImage')}</div>
              )}
              {a.status === 'LIVE' && (
                <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-white" /> LIVE
                </span>
              )}
              {(a.bidCount >= 5 || a.watcherCount >= 10) && (
                <span className="absolute end-2 top-2 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow">Hot</span>
              )}
            </div>
            <div className="p-3">
              <h3 className="line-clamp-2 min-h-[34px] text-sm font-bold text-[#0F172A] group-hover:text-[#F97316]">{a.title}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{t('currentBidLabel')}</p>
              <p className="text-base font-black tabular-nums text-[#F97316]">{money(a.currentBid > 0 ? a.currentBid : a.startingBid, a.currency, locale)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate text-end font-bold ${valueClass ?? 'text-[#0F172A]'}`}>{value}</dd>
    </div>
  );
}
