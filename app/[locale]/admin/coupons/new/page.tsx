import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { CouponForm } from '@/components/admin/CouponForm';
import { requireAdmin } from '@/lib/auth/require-admin';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCouponNewPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/coupons/new`);
  const t = await getTranslations({ locale, namespace: 'admin.coupons' });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link
          href={`/${locale}/admin/coupons`}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          &larr; {t('backToList')}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {t('newTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('newSubtitle')}</p>
      </header>

      <AdminCard>
        <CouponForm locale={locale} />
      </AdminCard>
    </div>
  );
}
