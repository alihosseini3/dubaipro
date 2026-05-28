import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { ShippingRowActions } from '@/components/admin/ShippingRowActions';
import { ShippingSettingsCard } from '@/components/admin/ShippingSettingsCard';
import { ShippingTesterCard } from '@/components/admin/ShippingTesterCard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getShippingSettings } from '@/lib/shipping/calculate';
import {
  listAllShippingMethods,
  listShippingZones
} from '@/lib/shipping/service';
import type { ShippingMethodDTO, ShippingZoneDTO } from '@/types/shipping';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminShippingPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/shipping`);

  const t = await getTranslations({ locale, namespace: 'admin.shipping' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const [methods, zones, settings] = await Promise.all([
    listAllShippingMethods(),
    listShippingZones(),
    getShippingSettings()
  ]);

  const columns: Column<ShippingMethodDTO>[] = [
    {
      key: 'name',
      header: t('headerName'),
      render: (m) => (
        <div>
          <Link
            href={`/${locale}/admin/shipping/${m.id}/edit`}
            className="text-sm font-semibold text-slate-900 hover:underline"
          >
            {m.name}
          </Link>
          {m.description && (
            <p className="line-clamp-1 text-xs text-slate-500">{m.description}</p>
          )}
        </div>
      )
    },
    {
      key: 'price',
      header: t('headerPrice'),
      render: (m) => (
        <span className="font-semibold text-slate-900">
          {m.price === 0 ? (
            <span className="text-emerald-600">{t('free')}</span>
          ) : (
            m.price.toFixed(2)
          )}
        </span>
      )
    },
    {
      key: 'days',
      header: t('headerEstimatedDays'),
      render: (m) =>
        m.estimatedDays === 0 ? t('sameDay') : t('daysValue', { days: m.estimatedDays })
    },
    {
      key: 'order',
      header: t('headerSortOrder'),
      render: (m) => m.sortOrder
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <ShippingRowActions id={m.id} locale={locale} isActive={m.isActive} />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/shipping/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-base leading-none">+</span>
          {t('new')}
        </Link>
      </header>

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={methods}
          rowKey={(m) => m.id}
          emptyLabel={tCommon('empty')}
        />
      </AdminCard>

      <header className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {t('zonesTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('zonesSubtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/shipping/zones/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-base leading-none">+</span>
          {t('zoneNew')}
        </Link>
      </header>

      <AdminCard>
        <AdminTable
          columns={
            [
              {
                key: 'name',
                header: t('zoneName'),
                render: (z: ShippingZoneDTO) => (
                  <Link
                    href={`/${locale}/admin/shipping/zones/${z.id}/edit`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {z.name}
                  </Link>
                )
              },
              {
                key: 'countries',
                header: t('zoneCountries'),
                render: (z: ShippingZoneDTO) => (
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {z.countries.join(', ')}
                  </code>
                )
              },
              {
                key: 'methods',
                header: t('zoneMethodsCount'),
                render: (z: ShippingZoneDTO) =>
                  methods.filter((m) => m.zoneId === z.id).length
              },
              {
                key: 'active',
                header: t('headerStatus'),
                render: (z: ShippingZoneDTO) =>
                  z.isActive ? (
                    <span className="text-emerald-600">{t('active')}</span>
                  ) : (
                    <span className="text-slate-400">{t('inactive')}</span>
                  )
              }
            ] as Column<ShippingZoneDTO>[]
          }
          rows={zones}
          rowKey={(z) => z.id}
          emptyLabel={tCommon('empty')}
        />
      </AdminCard>

      <header className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('settingsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('settingsSubtitle')}</p>
      </header>
      <AdminCard>
        <ShippingSettingsCard initial={settings} />
      </AdminCard>

      <header className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">
          {t('testerTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('testerSubtitle')}</p>
      </header>
      <AdminCard>
        <ShippingTesterCard />
      </AdminCard>
    </div>
  );
}
