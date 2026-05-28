import { getHeaderSettings } from '@/lib/header/service';

import { MainHeader } from './MainHeader';
import { MobileHeader } from './MobileHeader';
import { NavBar } from './NavBar';
import { StickyShell } from './StickyShell';
import { TopBar } from './TopBar';

type Props = { locale: string };

/**
 * Production header for the storefront.
 *
 * Three layered bars on top of one another, all sticky as a single
 * unit so the search + nav stay reachable as the user scrolls. Each
 * sub-component is independently composable: a campaign landing page
 * could swap NavBar for a slimmer hero CTA without touching the
 * other layers.
 *
 * Design tokens (see globals.css / Tailwind config):
 *   - #020617   utility bar (slightly darker than primary)
 *   - #0F172A   main header (primary)
 *   - #111827   nav bar (slightly lighter than primary)
 *   - #F97316   accent (CTA, hover, badges)
 *
 * Performance:
 *   - Header itself + TopBar + MainHeader + NavBar are Server
 *     Components: zero client-side data fetches on first paint.
 *   - Only the truly interactive bits (search, mega menu, drawer,
 *     user menu, switchers) ship as client components.
 *   - `react.cache()` on currency / user / categories means the
 *     three layers share lookups within a single request.
 */
export async function Header({ locale }: Props) {
  // Single read here — both child layers and `react.cache()` reuse it.
  // The `showTopBar` flag is admin-controlled; when false, the entire
  // utility bar (40px) is removed, not just visually hidden.
  const settings = await getHeaderSettings();

  return (
    <StickyShell>
      <div className="md:hidden">
        <MobileHeader locale={locale} />
      </div>
      <div className="hidden md:block">
        {settings.showTopBar && <TopBar locale={locale} />}
        <MainHeader locale={locale} />
        <NavBar locale={locale} />
      </div>
    </StickyShell>
  );
}
