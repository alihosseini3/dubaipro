import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { ShippingZoneForm } from '@/components/admin/ShippingZoneForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getShippingZone } from '@/lib/shipping/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminShippingZoneEditPage({ params }: Props) {
  const { locale, id } = await params;
  await requireAdmin(locale, `/${locale}/admin/shipping/zones/${id}/edit`);
  const t = await getTranslations({ locale, namespace: 'admin.shipping' });

  const zone = await getShippingZone(id);
  if (!zone) notFound();

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
          {t('zoneEditTitle', { name: zone.name })}
        </h1>
      </header>
      <AdminCard>
        <ShippingZoneForm locale={locale} initial={zone} />
      </AdminCard>
    </div>
  );
}
