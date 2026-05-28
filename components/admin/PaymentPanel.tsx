import { getTranslations } from 'next-intl/server';

import { AdminCard } from './AdminCard';
import { StatusBadge } from './StatusBadge';

type PaymentRow = {
  id: string;
  provider: string;
  providerId: string | null;
  status: string;
  amount: { toString(): string } | number | string;
  currency: string;
  errorMessage: string | null;
  createdAt: Date;
};

type PaymentPanelProps = {
  payments: PaymentRow[];
  locale: string;
};

export async function PaymentPanel({ payments, locale }: PaymentPanelProps) {
  const t = await getTranslations({ locale, namespace: 'payment' });

  return (
    <AdminCard title={t('paymentTitle')}>
      {payments.length === 0 ? (
        <p className="text-xs text-slate-500">{t('noPayments')}</p>
      ) : (
        <ul className="space-y-3">
          {payments.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    {p.provider}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {Number(p.amount).toFixed(2)}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      {p.currency}
                    </span>
                  </span>
                </div>
                <StatusBadge status={p.status} variant="order" />
              </div>
              {p.providerId && (
                <div className="mt-1.5 truncate font-mono text-[10px] text-slate-400">
                  {p.providerId}
                </div>
              )}
              {p.errorMessage && (
                <div className="mt-1.5 text-[11px] text-red-600">
                  {p.errorMessage}
                </div>
              )}
              <div className="mt-1 text-[10px] text-slate-400">
                {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
