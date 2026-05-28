import Link from 'next/link';
import type { ComponentType } from 'react';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

import { SectionHeader } from './CategoriesSection';
import {
  ArrowRightIcon,
  BuildingIcon,
  CartIcon,
  PackageIcon,
  SparkleIcon,
  TagIcon,
  WarehouseIcon
} from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

type Card = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: string;
  accent?: string;
};

type IconComponent = ComponentType<{ className?: string }>;

/** Icon registry — admin types one of these keys in the JSON config. */
const ICONS: Record<string, IconComponent> = {
  cart: CartIcon,
  package: PackageIcon,
  sparkle: SparkleIcon,
  warehouse: WarehouseIcon,
  building: BuildingIcon,
  tag: TagIcon
};

/** Accent palette — pairs a chip background with hover ring colour. */
const ACCENTS: Record<
  string,
  { chip: string; ring: string; cta: string }
> = {
  orange: {
    chip: 'bg-orange-100 text-orange-700',
    ring: 'group-hover:ring-orange-300',
    cta: 'text-orange-600'
  },
  sky: {
    chip: 'bg-sky-100 text-sky-700',
    ring: 'group-hover:ring-sky-300',
    cta: 'text-sky-600'
  },
  violet: {
    chip: 'bg-violet-100 text-violet-700',
    ring: 'group-hover:ring-violet-300',
    cta: 'text-violet-600'
  },
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700',
    ring: 'group-hover:ring-emerald-300',
    cta: 'text-emerald-600'
  },
  rose: {
    chip: 'bg-rose-100 text-rose-700',
    ring: 'group-hover:ring-rose-300',
    cta: 'text-rose-600'
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700',
    ring: 'group-hover:ring-amber-300',
    cta: 'text-amber-600'
  }
};

/**
 * Global-shopping band — explains the "we shop on your behalf" services
 * with one card per platform (Amazon UAE, Noon, Shein, Alibaba, Dubai
 * markets, …). Cards are admin-driven via `config.cards` so adding a
 * new channel is a JSON edit, not a code change.
 */
export function GlobalShoppingSection({ locale, section }: Props) {
  const cards = ((section.config.cards as Card[] | undefined) ?? []).filter(
    (c) => c && typeof c.title === 'string'
  );
  if (cards.length === 0) return null;

  const base = `/${locale}`;

  return (
    <section aria-labelledby="home-global" className="space-y-6">
      <SectionHeader
        id="home-global"
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={withLocale(base, section.ctaHref)}
      />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = ICONS[card.icon ?? 'cart'] ?? CartIcon;
          const palette = ACCENTS[card.accent ?? 'orange'] ?? ACCENTS.orange;
          const href = withLocale(base, card.ctaHref ?? null);

          const Wrapper = href ? Link : 'div';
          const wrapperProps = href ? { href } : {};

          return (
            <li key={`${card.title}-${i}`}>
              <Wrapper
                {...(wrapperProps as { href: string })}
                className={`group flex h-full flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg ${palette.ring}`}
              >
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${palette.chip}`}
                >
                  <Icon className="h-6 w-6" />
                </span>

                <div className="flex-1 space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {card.description}
                  </p>
                </div>

                {card.ctaLabel && href && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold transition ${palette.cta}`}
                  >
                    {card.ctaLabel}
                    <ArrowRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </span>
                )}
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
