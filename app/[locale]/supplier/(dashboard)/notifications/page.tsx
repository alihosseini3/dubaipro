import { getTranslations } from 'next-intl/server';

import { requireSupplier } from '@/lib/auth/require-supplier';
import { NotificationList } from '@/components/notifications/NotificationList';

type Props = { params: Promise<{ locale: string }> };

export default async function SupplierNotificationsPage({ params }: Props) {
  const { locale } = await params;
  await requireSupplier(locale, `/${locale}/supplier/notifications`);
  const t = await getTranslations({ locale, namespace: 'notifications' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>
      <NotificationList locale={locale} />
    </div>
  );
}
