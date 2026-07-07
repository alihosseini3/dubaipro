import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { UserCreateForm } from '@/components/admin/UserCreateForm';
import { requireAdmin } from '@/lib/auth/require-admin';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCreateUserPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/users/new`);

  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: 'admin.users' }),
    getTranslations({ locale, namespace: 'admin.common' })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${locale}/admin/users`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('backToList')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{t('newUserTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('newUserSubtitle')}</p>
      </header>

      <AdminCard>
        <div className="p-6">
          <UserCreateForm locale={locale} />
        </div>
      </AdminCard>
    </div>
  );
}
