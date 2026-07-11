import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { PlansManager } from '@/components/admin/PlansManager';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPlansPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/plans`);
  const t = await getTranslations({ locale, namespace: 'admin.plans' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <PlansManager />
    </div>
  );
}
