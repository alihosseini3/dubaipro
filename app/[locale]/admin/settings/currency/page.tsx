import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { CurrencyRateHistoryPanel } from '@/components/admin/CurrencyRateHistory';
import { CurrencyRatesForm } from '@/components/admin/CurrencyRatesForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listRates } from '@/lib/currency/rates';
import type { CurrencyRateDTO } from '@/types/currency';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCurrencyPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/settings/currency`);

  const t = await getTranslations({ locale, namespace: 'admin.currency' });
  const rows = await listRates();
  const initial: CurrencyRateDTO[] = rows.map((r) => ({
    code: r.code,
    rate: r.rate,
    updatedAt: r.updatedAt,
    isDefault: r.isDefault
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AdminCard>
            <CurrencyRatesForm initial={initial} />
          </AdminCard>
        </div>
        <aside className="lg:col-span-2">
          <AdminCard>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t('historyTitle')}
            </h2>
            <CurrencyRateHistoryPanel locale={locale} />
          </AdminCard>
        </aside>
      </div>
    </div>
  );
}
