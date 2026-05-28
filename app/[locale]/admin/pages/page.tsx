import Link from 'next/link';

import { PagesManager } from '@/components/admin/pages/PagesManager';
import { listPages } from '@/lib/pages/service';

type Props = { params: Promise<{ locale: string }> };

export const dynamic = 'force-dynamic';

/**
 * /admin/pages — list + create CMS pages. Auth is enforced by the
 * admin layout (`requireAdmin`), so we don't repeat the check here.
 */
export default async function AdminPagesPage({ params }: Props) {
  const { locale } = await params;
  const { items, total } = await listPages({ page: 1, limit: 20 });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link
              href={`/${locale}/admin/dashboard`}
              className="hover:text-slate-700"
            >
              Admin
            </Link>{' '}
            / Pages
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Build the public site&rsquo;s content pages — about, contact,
            policies, landing pages — and wire them into the header from{' '}
            <Link
              href={`/${locale}/admin/settings/header`}
              className="text-orange-600 hover:underline"
            >
              Header settings
            </Link>
            .
          </p>
        </div>
      </header>

      <PagesManager initial={items} initialTotal={total} locale={locale} />
    </div>
  );
}
