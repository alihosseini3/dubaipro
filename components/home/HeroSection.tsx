import Link from 'next/link';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

type Props = { locale: string; section: HomepageSectionDTO };

/**
 * Hero band — first thing a visitor sees.
 *
 * Layout:
 *   - Wide gradient background (slate → orange-tinted) with a soft
 *     decorative pattern. No JS, no image dependency.
 *   - Optional `badge` pill above the headline.
 *   - Up to two CTAs (primary orange, secondary outline).
 *   - Optional `chips` row (config.chips) — three trust badges.
 *   - Optional `imageUrl` — rendered on the right side at md+; on
 *     mobile the image stacks under the text.
 */
export function HeroSection({ locale, section }: Props) {
  const chips = (section.config.chips as string[] | undefined) ?? [];
  const base = `/${locale}`;
  const primaryHref = withLocale(base, section.ctaHref);
  const secondaryHref = withLocale(base, section.ctaSecondaryHref);

  return (
    <section
      aria-label={section.title}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#7C2D12] text-white shadow-xl"
    >
      {/* Decorative dotted pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />
      {/* Decorative orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-32 -top-32 h-80 w-80 rounded-full bg-orange-500/30 blur-3xl"
      />

      <div className="relative grid items-center gap-8 px-6 py-12 md:grid-cols-[1.2fr_1fr] md:gap-12 md:px-12 md:py-16 lg:px-16 lg:py-20">
        <div className="space-y-6">
          {section.badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
              {section.badge}
            </span>
          )}

          <h1 className="text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {section.title}
          </h1>

          {section.subtitle && (
            <p className="max-w-xl text-base leading-relaxed text-slate-200 md:text-lg">
              {section.subtitle}
            </p>
          )}

          {(section.ctaLabel || section.ctaSecondaryLabel) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {section.ctaLabel && primaryHref && (
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(249,115,22,0.4)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_32px_rgba(249,115,22,0.5)]"
                >
                  {section.ctaLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              )}
              {section.ctaSecondaryLabel && secondaryHref && (
                <Link
                  href={secondaryHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
                >
                  {section.ctaSecondaryLabel}
                </Link>
              )}
            </div>
          )}

          {chips.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-4">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-sm"
                >
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  {chip}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Visual side — admin-uploaded image OR a stylised stack of
         *  cards as a fallback so the hero never feels empty. */}
        {section.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={section.imageUrl}
            alt=""
            className="hidden w-full rounded-2xl object-cover shadow-2xl md:block md:aspect-[4/3]"
          />
        ) : (
          <DefaultHeroVisual />
        )}
      </div>
    </section>
  );
}

/** Pretty fallback so a freshly-installed instance still looks rich.
 *  Three glassmorphic cards stacked at slight angles. */
function DefaultHeroVisual() {
  return (
    <div className="relative hidden h-[280px] md:block lg:h-[340px]" aria-hidden>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full w-full max-w-md">
          <div className="absolute inset-x-8 top-2 h-32 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md rotate-[-4deg]" />
          <div className="absolute inset-x-4 top-12 h-40 rounded-2xl border border-white/15 bg-gradient-to-br from-orange-500/20 to-orange-600/10 shadow-2xl backdrop-blur-md" />
          <div className="absolute inset-x-0 top-24 flex h-48 flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md rotate-[3deg]">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-xs font-black">
                DP
              </span>
              <span className="text-sm font-semibold">DubaiPro Order #1247</span>
            </div>
            <div className="flex-1 space-y-2 text-xs text-slate-200">
              <div className="flex justify-between">
                <span>Items</span>
                <span className="font-semibold text-white">24</span>
              </div>
              <div className="flex justify-between">
                <span>From</span>
                <span className="font-semibold text-white">Dubai, UAE</span>
              </div>
              <div className="flex justify-between">
                <span>To</span>
                <span className="font-semibold text-white">Tehran, IR</span>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-500/20 px-3 py-2 text-center text-xs font-bold text-emerald-300">
              Shipped · 2 days
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}
