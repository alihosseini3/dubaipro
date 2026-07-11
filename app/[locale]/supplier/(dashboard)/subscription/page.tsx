import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { getActiveSubscription, listPlans } from '@/lib/subscriptions/service';
import { getUsageSummary } from '@/lib/subscriptions/limits';
import { UpgradePanel } from '@/components/supplier/UpgradePanel';

type Props = { params: Promise<{ locale: string }> };

function planName(nameTranslations: unknown, locale: string): string {
  const names = (nameTranslations ?? {}) as Record<string, string>;
  return names[locale] ?? names.en ?? '—';
}

function Meter({
  label,
  used,
  limit,
  unlimitedLabel
}: {
  label: string;
  used: number;
  limit: number | null;
  unlimitedLabel: string;
}) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const over = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className={over ? 'font-bold text-rose-600' : 'text-slate-500'}>
          {used} / {limit === null ? unlimitedLabel : limit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: limit === null ? '4%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Supplier subscription overview: current plan, usage meters against the
 * plan limits, and the upgrade comparison table. Billing v1 is manual —
 * upgrades go through the platform team.
 */
export default async function SupplierSubscriptionPage({ params }: Props) {
  const { locale } = await params;
  const { supplier } = await requireSupplierPermission(
    locale,
    'supplier.subscription.view',
    `/${locale}/supplier/subscription`
  );

  const [t, subscription, usage, plans] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.subscription' }),
    getActiveSubscription(supplier.id),
    getUsageSummary(supplier.id),
    listPlans()
  ]);

  const fmt = new Intl.NumberFormat(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      {/* Current plan */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold uppercase text-orange-700">
            {planName(subscription.plan.nameTranslations, locale)}
          </span>
          <span className="text-xs text-slate-500">
            {subscription.currentPeriodEnd
              ? t('validUntil', {
                  date: new Date(subscription.currentPeriodEnd).toLocaleDateString(locale)
                })
              : t('neverExpires')}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Meter
            label={t('productsMeter')}
            used={usage.products.used}
            limit={usage.products.limit}
            unlimitedLabel={t('unlimited')}
          />
          <Meter
            label={t('employeesMeter')}
            used={usage.employees.used}
            limit={usage.employees.limit}
            unlimitedLabel={t('unlimited')}
          />
        </div>
      </div>

      {/* Plan comparison */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
          {t('compareTitle')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 text-start">{t('colPlan')}</th>
                <th className="px-5 py-2 text-start">{t('colPrice')}</th>
                <th className="px-5 py-2 text-start">{t('colProducts')}</th>
                <th className="px-5 py-2 text-start">{t('colEmployees')}</th>
                <th className="px-5 py-2 text-start">{t('colImages')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const isCurrent = plan.id === subscription.plan.id;
                return (
                  <tr
                    key={plan.id}
                    className={`border-t border-slate-100 dark:border-slate-700 ${
                      isCurrent ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''
                    }`}
                  >
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                      {planName(plan.nameTranslations, locale)}
                      {isCurrent && (
                        <span className="ms-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t('current')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {Number(plan.price) === 0
                        ? t('free')
                        : t('pricePerYear', {
                            price: fmt.format(Number(plan.price)),
                            currency: plan.currency
                          })}
                    </td>
                    <td className="px-5 py-3">{plan.maxProducts ?? t('unlimited')}</td>
                    <td className="px-5 py-3">{plan.maxEmployees ?? t('unlimited')}</td>
                    <td className="px-5 py-3">
                      {plan.maxImagesPerProduct ?? t('unlimited')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700">
          {t('upgradeHint')}
        </p>
      </div>

      {/* Self-service upgrade (online gateway or manual transfer) */}
      <UpgradePanel currentPlanId={subscription.plan.id} />
    </div>
  );
}
