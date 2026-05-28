import Link from 'next/link';

import { SectionsManager } from '@/components/admin/homepage/SectionsManager';
import { ensureDefaults, listSections } from '@/lib/homepage/service';

type Props = { params: Promise<{ locale: string }> };

// Always read the latest section list — admins expect their reorder /
// toggle / edit changes to be reflected on every refresh.
export const dynamic = 'force-dynamic';

/**
 * /admin/homepage — single screen for managing every band on the
 * public storefront homepage. Auth is enforced by the admin layout
 * (`requireAdmin`), so we don't repeat the check here.
 *
 * On first visit (empty table) we trigger `ensureDefaults` so the
 * admin always sees a populated list to edit instead of an empty UI.
 */
export default async function AdminHomepagePage({ params }: Props) {
  const { locale } = await params;
  await ensureDefaults().catch(() => {
    /* Swallow — empty list still renders, admin can create rows. */
  });
  const sections = await listSections();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link
              href={`/${locale}/admin/dashboard`}
              className="hover:text-slate-700"
            >
              Dashboard
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            <span>Homepage</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Homepage builder</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reorder, toggle, and edit every band shown on{' '}
            <Link
              href={`/${locale}`}
              className="font-semibold text-orange-600 hover:underline"
            >
              the storefront homepage
            </Link>
            .
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 sm:p-6">
        <SectionsManager initial={sections} />
      </section>

      <p className="text-xs text-slate-500">
        Tip: drag the handle on the left of any row to reorder. Toggle the green
        switch to hide a section without deleting it.
      </p>
    </div>
  );
}
