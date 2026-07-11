import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { SubscriptionsManager } from '@/components/admin/SubscriptionsManager';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminSubscriptionsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/subscriptions`);
  const t = await getTranslations({ locale, namespace: 'admin.subscriptions' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <SubscriptionsManager />
    </div>
  );
}
