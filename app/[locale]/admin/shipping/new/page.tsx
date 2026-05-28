import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { ShippingForm } from '@/components/admin/ShippingForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listShippingZones } from '@/lib/shipping/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminShippingNewPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/shipping/new`);
  const t = await getTranslations({ locale, namespace: 'admin.shipping' });
  const zones = await listShippingZones();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link
          href={`/${locale}/admin/shipping`}
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
        <ShippingForm locale={locale} zones={zones} />
      </AdminCard>
    </div>
  );
}
