import type { ReactNode } from 'react';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { requireAdmin } from '@/lib/auth/require-admin';

type AdminLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Admin shell. Sits inside the [locale] segment so it inherits the
 * i18n provider but renders its own chrome (sidebar + topbar).
 *
 * NOTE: the public Navbar/Footer are rendered by `app/[locale]/layout.tsx`.
 * That component should detect the `/admin` path via the `x-pathname`
 * header set in `middleware.ts` and skip them; this layout therefore
 * owns the entire admin viewport.
 */
export default async function AdminLayout({
  children,
  params
}: AdminLayoutProps) {
  const { locale } = await params;
  // Guard runs only here. Middleware also gates /admin, so this is the
  // single source of truth at the layout level — no extra redirects.
  const user = await requireAdmin(locale, `/${locale}/admin`);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      <AdminSidebar locale={locale} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={user} locale={locale} />
        <main className="flex-1 overflow-x-auto">
          <div className="mx-auto max-w-screen-2xl p-3 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
