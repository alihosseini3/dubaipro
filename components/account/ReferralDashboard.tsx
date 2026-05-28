'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Money = { currency: string; amount: number };

type Stats = {
  code: string | null;
  totalReferred: number;
  totalEarned: Money[];
  pending: Money[];
  paid: Money[];
};

type Commission = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  createdAt: string;
  paidAt: string | null;
};

export function ReferralDashboard({
  code,
  shareLink,
  stats,
  commissions
}: {
  code: string;
  shareLink: string;
  stats: Stats;
  commissions: Commission[];
}) {
  const t = useTranslations('account.referral');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      {/* Share */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('shareTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('shareHelp')}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={shareLink}
            className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {t('codeLabel')}: <span className="font-mono">{code}</span>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('totalReferred')} value={String(stats.totalReferred)} />
        <StatCard
          label={t('pendingEarnings')}
          value={fmtMoneyList(stats.pending)}
        />
        <StatCard label={t('paidEarnings')} value={fmtMoneyList(stats.paid)} />
      </section>

      {/* History */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('historyTitle')}
          </h2>
        </header>
        {commissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{t('historyEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">{t('colDate')}</th>
                  <th className="px-4 py-2 text-left">{t('colOrder')}</th>
                  <th className="px-4 py-2 text-right">{t('colAmount')}</th>
                  <th className="px-4 py-2 text-left">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-slate-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {c.orderId.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {c.amount.toFixed(2)} {c.currency}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value || '—'}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Commission['status'] }) {
  const map: Record<Commission['status'], string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-blue-50 text-blue-700',
    PAID: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-700'
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

function fmtMoneyList(list: Money[]): string {
  if (list.length === 0) return '';
  return list.map((m) => `${m.amount.toFixed(2)} ${m.currency}`).join(' · ');
}
