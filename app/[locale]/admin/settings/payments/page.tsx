import { getTranslations } from 'next-intl/server';

import { PaymentSettingsForm } from '@/components/admin/PaymentSettingsForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getPaymentSettingsPublic } from '@/lib/payments/settings';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPaymentSettingsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'admin.paymentSettings' });
  const settings = await getPaymentSettingsPublic();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <PaymentSettingsForm initial={settings} />
    </div>
  );
}
