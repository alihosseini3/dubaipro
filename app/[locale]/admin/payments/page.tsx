import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminPaymentsList } from '@/components/admin/AdminPaymentsList';
import { requireAdmin } from '@/lib/auth/require-admin';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPaymentsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/payments`);
  const t = await getTranslations({ locale, namespace: 'admin.payments' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <AdminCard>
        <AdminPaymentsList />
      </AdminCard>
    </div>
  );
}
