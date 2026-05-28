import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { ShippingForm } from '@/components/admin/ShippingForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getShippingMethod, listShippingZones } from '@/lib/shipping/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminShippingEditPage({ params }: Props) {
  const { locale, id } = await params;
  await requireAdmin(locale, `/${locale}/admin/shipping/${id}/edit`);
  const t = await getTranslations({ locale, namespace: 'admin.shipping' });

  const [method, zones] = await Promise.all([
    getShippingMethod(id),
    listShippingZones()
  ]);
  if (!method) notFound();

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
          {t('editTitle', { name: method.name })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('editSubtitle')}</p>
      </header>

      <AdminCard>
        <ShippingForm locale={locale} initial={method} zones={zones} />
      </AdminCard>
    </div>
  );
}
