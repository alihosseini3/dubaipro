import { useTranslations } from 'next-intl';

import type { SupplierPublic } from '@/lib/suppliers/types';

const BUSINESS_KEYS = {
  MANUFACTURER: 'business_MANUFACTURER',
  TRADING_COMPANY: 'business_TRADING_COMPANY',
  DISTRIBUTOR: 'business_DISTRIBUTOR',
  WHOLESALER: 'business_WHOLESALER',
  AGENT: 'business_AGENT',
  OTHER: 'business_OTHER'
} as const;

export function SupplierAboutPanel({ supplier }: { supplier: SupplierPublic }) {
  const t = useTranslations('suppliers');

  const empty =
    !supplier.description &&
    !supplier.businessType &&
    !supplier.yearEstablished &&
    supplier.exportMarkets.length === 0 &&
    !supplier.minOrderQuantity &&
    !supplier.shippingNotes;

  if (empty) {
    return <p className="text-sm text-slate-500">{t('about.empty')}</p>;
  }

  const rows: Array<[string, string | number | null]> = [
    [
      t('about.businessType'),
      supplier.businessType ? t(BUSINESS_KEYS[supplier.businessType]) : null
    ],
    [t('about.yearEstablished'), supplier.yearEstablished],
    [t('about.country'), supplier.country],
    [t('about.city'), supplier.city],
    [
      t('about.exportMarkets'),
      supplier.exportMarkets.length > 0 ? supplier.exportMarkets.join(', ') : null
    ],
    [t('about.moq'), supplier.minOrderQuantity]
  ];

  return (
    <div className="space-y-6">
      {supplier.description ? (
        <div className="prose prose-sm max-w-3xl whitespace-pre-line text-slate-700">
          {supplier.description}
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {rows
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
      </dl>

      {supplier.shippingNotes ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            {t('about.shippingNotes')}
          </h3>
          <p className="whitespace-pre-line text-sm text-slate-600">
            {supplier.shippingNotes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
