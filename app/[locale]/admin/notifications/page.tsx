import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { BroadcastComposer } from '@/components/admin/BroadcastComposer';

type Props = { params: Promise<{ locale: string }> };

/**
 * Admin broadcast: in-app announcement to a segment (all users / buyers /
 * suppliers). Mass email campaigns stay in the marketing module.
 */
export default async function AdminNotificationsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/notifications`);
  const t = await getTranslations({ locale, namespace: 'admin.broadcast' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <BroadcastComposer />
    </div>
  );
}
