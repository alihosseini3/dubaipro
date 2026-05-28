import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { UserDeleteButton } from '@/components/admin/UserDeleteButton';
import { UserDetailTabs } from '@/components/admin/UserDetailTabs';
import { UserPasswordReset } from '@/components/admin/UserPasswordReset';
import { UserRoleForm } from '@/components/admin/UserRoleForm';
import { Price } from '@/components/currency/Price';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const admin = await requireAdmin(locale, `/${locale}/admin/users/${id}`);

  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: 'admin.users' }),
    getTranslations({ locale, namespace: 'admin.common' })
  ]);

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalPrice: true,
          createdAt: true,
          _count: { select: { items: true } }
        }
      },
      supplier: { select: { id: true, name: true, country: true, verified: true } }
    }
  });

  if (!user) notFound();

  const isSelf = user.id === admin.id;
  // First address that has a phone number — addresses are the only source
  // of phone numbers in the current schema. Default-marked addresses win.
  const primaryPhone = user.addresses.find((a) => a.phone)?.phone ?? null;

  const profilePanel = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <AdminCard title={t('profileTitle')} description={t('profileSubtitle')}>
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">{t('fieldName')}</dt>
            <dd className="font-semibold text-slate-900">{user.name}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">{t('headerEmail')}</dt>
            <dd className="font-mono text-xs text-slate-700">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">{t('fieldRole')}</dt>
            <dd>
              <StatusBadge status={user.role} variant="role" />
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">{t('joinedAt')}</dt>
            <dd className="tabular-nums text-slate-700">{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      </AdminCard>

      <AdminCard title={t('contactTitle')} description={t('contactSubtitle')}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t('fieldPhone')}</span>
            <span className="font-mono text-slate-700">
              {primaryPhone ?? '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t('addressesTitle')}</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {user.addresses.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{t('ordersTitle')}</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {user.orders.length}
            </span>
          </div>
        </div>
      </AdminCard>

      {user.supplier && (
        <AdminCard title={t('supplierTitle')} className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('supplierName')}
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {user.supplier.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('supplierCountry')}
              </dt>
              <dd className="mt-0.5 text-slate-700">{user.supplier.country}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('supplierVerified')}
              </dt>
              <dd className="mt-0.5">
                <StatusBadge
                  status={user.supplier.verified ? 'TRUE' : 'FALSE'}
                  variant="bool"
                />
              </dd>
            </div>
          </dl>
        </AdminCard>
      )}
    </div>
  );

  const ordersPanel = (
    <AdminCard title={t('ordersTitle')} description={t('ordersSubtitle')}>
      {user.orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('noOrders')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {user.orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/${locale}/admin/orders/${order.id}`}
                className="flex items-center justify-between gap-3 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {t('orderIdShort', { id: order.id.slice(-8).toUpperCase() })}
                    </span>
                    <StatusBadge status={order.status} variant="order" />
                  </div>
                  <div className="mt-1 text-xs text-slate-500 tabular-nums">
                    {formatDate(order.createdAt)} ·{' '}
                    {t('orderItems', { count: order._count.items })}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  <Price amount={Number(order.totalPrice)} locale={locale} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );

  const addressesPanel = (
    <AdminCard title={t('addressesTitle')} description={t('addressesSubtitle')}>
      {user.addresses.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {t('noAddresses')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {user.addresses.map((addr) => (
            <li
              key={addr.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {addr.fullName}
                  </p>
                  <p className="font-mono text-xs text-slate-600">{addr.phone}</p>
                </div>
                {addr.isDefault && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {t('addressDefault')}
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t('fieldCountry')}</dt>
                  <dd className="text-slate-800">{addr.country}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t('fieldCity')}</dt>
                  <dd className="text-slate-800">{addr.city}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t('fieldAddressLine')}</dt>
                  <dd className="text-right text-slate-800">{addr.addressLine}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">{t('fieldPostalCode')}</dt>
                  <dd className="font-mono text-slate-800">{addr.postalCode}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/admin/users`}
            className="text-xs text-slate-500 transition-colors hover:text-slate-900"
          >
            ← {t('backToList')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <StatusBadge status={user.role} variant="role" />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <UserDetailTabs
            tabs={[
              { id: 'profile', label: t('tabProfile'), content: profilePanel },
              {
                id: 'orders',
                label: t('tabOrders'),
                badge: user.orders.length,
                content: ordersPanel
              },
              {
                id: 'addresses',
                label: t('tabAddresses'),
                badge: user.addresses.length,
                content: addressesPanel
              }
            ]}
          />
        </div>

        <aside className="space-y-4">
          <AdminCard title={t('actionsTitle')} description={t('actionsSubtitle')}>
            <UserRoleForm
              userId={user.id}
              currentName={user.name}
              currentRole={user.role}
              isSelf={isSelf}
            />
          </AdminCard>

          <AdminCard title={t('resetPassword')}>
            <UserPasswordReset userId={user.id} />
          </AdminCard>

          <AdminCard
            title={t('dangerZoneTitle')}
            description={t('dangerZoneSubtitle')}
            className="border-red-200"
          >
            <UserDeleteButton
              userId={user.id}
              userEmail={user.email}
              actingAdminId={admin.id}
              redirectTo={`/${locale}/admin/users`}
            />
          </AdminCard>
        </aside>
      </div>

      {/* `tCommon` is intentionally referenced to keep the namespace loaded
          even if an upstream edit removes the only call-site above. */}
      <span className="sr-only">{tCommon('details')}</span>
    </div>
  );
}
