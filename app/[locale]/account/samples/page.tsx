import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { requireUser } from '@/lib/auth/require-user';
import { listBuyerSamples } from '@/lib/samples/service';

type Props = { params: Promise<{ locale: string }> };

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-rose-50 text-rose-700',
  SHIPPED: 'bg-sky-50 text-sky-700',
  CLOSED: 'bg-slate-100 text-slate-500'
};

/** Buyer's sample requests with status + link into the SAMPLE thread. */
export default async function AccountSamplesPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/samples');
  const t = await getTranslations({ locale, namespace: 'samples' });

  const { items } = await listBuyerSamples(user.id, 1, 50);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountSidebar locale={locale} user={user} />
      <div className="space-y-4 lg:col-span-2">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">{t('buyerTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('buyerSubtitle')}</p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">{t('buyerEmpty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {items.map((sample) => (
              <li key={sample.id} className="flex items-center gap-3 px-4 py-3">
                {sample.product.imageUrl ? (
                  <Image
                    src={sample.product.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 flex-none rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 flex-none rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${locale}/products/${sample.product.slug}`}
                    className="block truncate text-sm font-semibold text-slate-900 hover:text-orange-600"
                  >
                    {sample.product.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {sample.supplier.name} · {t('qty', { count: sample.quantity })} ·{' '}
                    {sample.createdAt.toLocaleDateString(locale)}
                  </p>
                </div>
                <span
                  className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[sample.status]}`}
                >
                  {t(`status.${sample.status}` as Parameters<typeof t>[0])}
                </span>
                {sample.conversationId && (
                  <Link
                    href={`/${locale}/account/messages/${sample.conversationId}`}
                    className="flex-none rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {t('openThread')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
