import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/prisma';
import { getDisplayCurrency } from '@/lib/currency/context';
import { formatDisplayFromAED } from '@/lib/currency/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountOrdersPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/orders');
  const t = await getTranslations({ locale, namespace: 'account' });

  const [orders, display] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } }
    }),
    getDisplayCurrency(locale)
  ]);

  const fmt = (n: number) => formatDisplayFromAED(n, display);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{t('ordersTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('ordersSubtitle')}</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">{t('noOrders')}</p>
          <Link
            href={`/${locale}/products`}
            className="mt-4 inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            {t('browseProducts')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">
                  {t('colOrder')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {t('colDate')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {t('colItems')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {t('colTotal')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {t('colStatus')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/account/orders/${o.id}`}
                      className="font-mono text-xs font-semibold text-slate-900 hover:underline"
                    >
                      #{o.id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o._count.items}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {fmt(Number(o.totalPrice))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} variant="order" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
