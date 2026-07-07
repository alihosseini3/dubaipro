import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { listCategories } from '@/lib/categories/service';
import {
  getHeaderSettings,
  listMegaMenuItems,
  listNavigationItems
} from '@/lib/header/service';
import { listAllAuctions } from '@/lib/auctions/service';

import { MegaMenu } from './MegaMenu';

type Props = { locale: string };

/**
 * Layer 3 — primary navigation bar. Slightly lighter than the main
 * header to create the layered effect Amazon/Alibaba use.
 *
 * Every visible link is read from `NavigationItem` (admin-managed) —
 * there is no hardcoded fallback. On desktop it hosts the mega menu,
 * curated nav links, and the CTA. Mobile now has a dedicated header
 * and full-screen drawer, so this component is desktop-only.
 */
export async function NavBar({ locale }: Props) {
  const [tMega, tNav, categories, settings, navItems, megaItems, liveAuctions] = await Promise.all([
    getTranslations({ locale, namespace: 'header.mega' }),
    getTranslations({ locale, namespace: 'navbar' }),
    listCategories().catch(() => []),
    getHeaderSettings(),
    listNavigationItems({ activeOnly: true }),
    listMegaMenuItems({ activeOnly: true }),
    listAllAuctions('LIVE').catch(() => []),
  ]);

  const base = `/${locale}`;
  const liveCount = liveAuctions.length;

  // Header reads ONLY from the database — no hardcoded links. When
  // the admin hasn't configured any nav items yet the bar is empty
  // (the mega-menu / categories trigger remains visible so the
  // storefront still has navigation).
  const navLinks = navItems.map((n) => ({
    href: n.href.startsWith('http')
      ? n.href
      : `${base}${n.href.startsWith('/') ? n.href : `/${n.href}`}`,
    label: n.label
  }));

  // Mega menu source: prefer the curated featured-categories list. If
  // the admin hasn't picked any, fall back to the full Category table
  // so the menu is never empty.
  const megaCategories =
    megaItems.length > 0
      ? megaItems.map((m) => ({
          id: m.id,
          name: m.title,
          slug: m.categorySlug,
          icon: null as string | null,
          productCount: 0
        }))
      : categories;

  return (
    <div className="bg-[#111827] text-white">
      <div className="mx-auto flex h-12 w-full max-w-[1600px] items-center gap-2 px-4 md:px-6 lg:px-8">
        {/* Desktop mega-menu trigger */}
        <div className="hidden lg:block">
          <MegaMenu
            locale={locale}
            categories={megaCategories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              icon: c.icon,
              countLabel: tMega('count', { count: c.productCount ?? 0 })
            }))}
            label={tMega('allCategories')}
            emptyLabel={tMega('empty')}
          />
        </div>

        {/* Center nav links */}
        <nav className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {/* Auctions — always-visible permanent link */}
            <li>
              <Link
                href={`${base}/auctions`}
                className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-orange-300 transition hover:bg-white/5 hover:text-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
                  <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
                  <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
                  <path d="M14 14.5V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.5" />
                  <path d="M22 19.5V19a2 2 0 0 0-2-2h-7.5" />
                  <path d="M14 10.5V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v5.5" />
                  <path d="M22 4.5V5a2 2 0 0 1-2 2h-7.5" />
                </svg>
                {tNav('auctions')}
                {liveCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                    LIVE
                  </span>
                )}
              </Link>
            </li>
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA — admin-controlled label + href. */}
        <Link
          href={
            settings.ctaHref.startsWith('http')
              ? settings.ctaHref
              : `${base}${settings.ctaHref.startsWith('/') ? settings.ctaHref : `/${settings.ctaHref}`}`
          }
          className="ms-auto inline-flex h-10 items-center rounded-xl bg-orange-500 px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_10px_24px_rgba(249,115,22,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <svg
            viewBox="0 0 24 24"
            className="me-1.5 h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {settings.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
