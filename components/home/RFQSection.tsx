import Link from 'next/link';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

import { ArrowRightIcon, MessageSquareIcon } from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

/**
 * RFQ banner — single big CTA inviting buyers to open a custom-quote
 * request. The visual is a chat bubble glyph; admins can override
 * `imageUrl` to show a brand image instead.
 */
export function RFQSection({ locale, section }: Props) {
  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section
      aria-labelledby="home-rfq"
      className="relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-8 sm:p-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -bottom-16 h-64 w-64 rounded-full bg-orange-400/20 blur-3xl"
      />

      <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)]">
            <MessageSquareIcon className="h-7 w-7" />
          </span>
          <div>
            <h2
              id="home-rfq"
              className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
            >
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="mt-1 max-w-xl text-sm text-slate-700">
                {section.subtitle}
              </p>
            )}
          </div>
        </div>

        {section.ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
          >
            {section.ctaLabel}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
