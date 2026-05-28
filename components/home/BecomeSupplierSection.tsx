import Link from 'next/link';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

import { ArrowRightIcon, CheckIcon, StoreIcon } from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

/**
 * Become-supplier band — split layout (text + visual). On md+ a glass
 * card mock-up sits next to the copy; on mobile the text is full-width
 * and the visual is hidden to save space.
 */
export function BecomeSupplierSection({ locale, section }: Props) {
  const benefits = (section.config.benefits as string[] | undefined) ?? [];
  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section
      aria-labelledby="home-supplier"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 p-8 text-white shadow-xl sm:p-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
            <StoreIcon className="h-3.5 w-3.5" />
            For suppliers
          </span>

          <h2
            id="home-supplier"
            className="text-3xl font-black tracking-tight sm:text-4xl"
          >
            {section.title}
          </h2>

          {section.subtitle && (
            <p className="max-w-xl text-base leading-relaxed text-slate-200">
              {section.subtitle}
            </p>
          )}

          {benefits.length > 0 && (
            <ul className="space-y-2 pt-2">
              {benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-slate-100"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {section.ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(249,115,22,0.4)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_32px_rgba(249,115,22,0.5)]"
            >
              {section.ctaLabel}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Glassmorphic dashboard preview — pure CSS, no image. */}
        <div className="hidden md:block">
          <div className="relative h-[260px]">
            <div className="absolute inset-x-2 top-0 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-orange-300">Sales · This week</span>
                <span className="text-emerald-300">+24%</span>
              </div>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {[40, 65, 50, 80, 55, 72, 90].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 rounded-sm bg-gradient-to-t from-orange-500/60 to-orange-300"
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                  <div className="text-base font-black">128</div>
                  <div className="text-slate-300">Orders</div>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                  <div className="text-base font-black">$8.4k</div>
                  <div className="text-slate-300">Revenue</div>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5">
                  <div className="text-base font-black">42</div>
                  <div className="text-slate-300">Buyers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
