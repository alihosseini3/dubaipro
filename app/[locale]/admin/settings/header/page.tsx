import Link from 'next/link';

import { HeaderSettingsForm } from '@/components/admin/header-settings/HeaderSettingsForm';
import { MegaMenuManager } from '@/components/admin/header-settings/MegaMenuManager';
import { NavigationItemsManager } from '@/components/admin/header-settings/NavigationItemsManager';
import { listCategories } from '@/lib/categories/service';
import {
  getHeaderSettings,
  listMegaMenuItems,
  listNavigationItems
} from '@/lib/header/service';
import { listPages } from '@/lib/pages/service';

type Props = { params: Promise<{ locale: string }> };

// `force-dynamic` so admins always see the latest values (the header
// service is request-cached, but page-level static caching would
// outlive that).
export const dynamic = 'force-dynamic';

/**
 * /admin/settings/header — single screen for everything the public
 * `<Header>` reads from the database. Three independently-saving
 * sections: General, Navigation, Mega menu.
 *
 * Auth: enforced by `app/[locale]/admin/layout.tsx` (`requireAdmin`),
 * so we don't repeat the check here.
 */
export default async function AdminHeaderSettingsPage({ params }: Props) {
  const { locale } = await params;

  // Fan out — every read is index-backed or singleton; total ~5ms.
  const [settings, navItems, megaItems, categories, pages] = await Promise.all([
    getHeaderSettings(),
    listNavigationItems({ activeOnly: false }),
    listMegaMenuItems({ activeOnly: false }),
    listCategories(),
    listPages({ activeOnly: false }).then((r) => r.items)
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link
              href={`/${locale}/admin/settings`}
              className="hover:text-slate-700"
            >
              Settings
            </Link>{' '}
            / Header
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Header
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Control the public site header — logo, top bar, navigation
            links and the mega menu — all from a single screen. Changes
            go live on the next page render.
          </p>
        </div>
        <Link
          href={`/${locale}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 3h7v7M21 3l-9 9M5 5h6M5 5v14h14v-6" />
          </svg>
          Preview live
        </Link>
      </header>

      <HeaderSettingsForm initial={settings} />
      <NavigationItemsManager initial={navItems} pages={pages} />
      <MegaMenuManager
        initial={megaItems}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug
        }))}
      />
    </div>
  );
}
