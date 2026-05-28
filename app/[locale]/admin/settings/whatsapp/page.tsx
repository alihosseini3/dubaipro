import { getTranslations } from 'next-intl/server';

import { WhatsAppSettingsForm } from '@/components/admin/WhatsAppSettingsForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getWhatsAppSettings } from '@/lib/whatsapp/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminWhatsAppSettingsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, '/admin/settings/whatsapp');
  const t = await getTranslations({ locale, namespace: 'admin.whatsapp' });

  const settings = await getWhatsAppSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <WhatsAppSettingsForm initial={settings} />
    </div>
  );
}
