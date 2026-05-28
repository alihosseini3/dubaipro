import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { CouponForm } from '@/components/admin/CouponForm';
import { CouponStatsPanel } from '@/components/admin/CouponStatsPanel';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getCouponById } from '@/lib/coupon/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminCouponEditPage({ params }: Props) {
  const { locale, id } = await params;
  await requireAdmin(locale, `/${locale}/admin/coupons/${id}/edit`);
  const t = await getTranslations({ locale, namespace: 'admin.coupons' });

  const coupon = await getCouponById(id);
  if (!coupon) notFound();

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
          {t('editTitle', { code: coupon.code })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('editSubtitle')}</p>
      </header>

      <AdminCard>
        <CouponForm locale={locale} initial={coupon} />
      </AdminCard>

      <AdminCard title={t('statsTitle')}>
        <CouponStatsPanel couponId={coupon.id} />
      </AdminCard>
    </div>
  );
}
