'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type Tab = {
  href: string;
  /** Source string of a regex, evaluated on the client. Server
   *  components cannot pass `RegExp` instances across the boundary. */
  match: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

type Props = {
  locale: string;
  tabs: Tab[];
};

/**
 * Fixed bottom tab bar — visible only on small screens (< md). Mirrors
 * the layout you'll see on Amazon, Alibaba and Noon mobile apps:
 * primary destinations one tap away. Active state derived from the
 * pathname so it stays in sync without prop-drilling.
 *
 * The bar uses the same dark palette as the desktop header and
 * respects iOS safe-area insets via the `.safe-bottom` helper.
 */
export function MobileBottomNavClient({ locale, tabs }: Props) {
  const pathname = usePathname() ?? '';
  // Strip `/[locale]` so the regex matchers can be locale-agnostic.
  const localePrefix = `/${locale}`;
  const path =
    pathname === localePrefix
      ? '/'
      : pathname.startsWith(`${localePrefix}/`)
        ? pathname.slice(localePrefix.length)
        : pathname;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0F172A] text-white shadow-[0_-4px_20px_rgba(2,6,23,0.35)] md:hidden safe-bottom"
    >
      <ul className="mx-auto grid max-w-[1600px] grid-cols-5">
        {tabs.map((t) => {
          const active = new RegExp(t.match).test(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? 'text-orange-400'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {/* Active indicator pill on top */}
                <span
                  className={`absolute inset-x-6 top-0 h-0.5 rounded-full transition ${
                    active ? 'bg-orange-500' : 'bg-transparent'
                  }`}
                />
                <span className="relative inline-flex h-6 w-6 items-center justify-center">
                  {t.icon}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="absolute -end-2 -top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_0_0_2px_#0F172A] animate-pop">
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  )}
                </span>
                <span className="truncate">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
