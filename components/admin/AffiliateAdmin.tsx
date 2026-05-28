'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Mini = { id: string; name: string; email: string };
type Referral = {
  id: string;
  code: string;
  createdAt: string;
  referrer: Mini;
  referred: Mini;
};
type Commission = {
  id: string;
  orderId: string;
  amount: string | number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  createdAt: string;
  paidAt: string | null;
  note: string | null;
  referrer: Mini;
};
type Total = {
  status: string;
  currency: string;
  amount: number;
  count: number;
};

export function AffiliateAdmin() {
  const t = useTranslations('admin.affiliate');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [totals, setTotals] = useState<Total[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/affiliate', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as {
        data: { referrals: Referral[]; commissions: Commission[]; totals: Total[] };
      };
      setReferrals(json.data.referrals);
      setCommissions(json.data.commissions);
      setTotals(json.data.totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  async function transition(id: string, status: Commission['status']) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/affiliate/commissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `status ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'transition failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="text-sm text-slate-500">{t('loading')}</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((tot) => (
          <div
            key={`${tot.status}:${tot.currency}`}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="text-xs uppercase text-slate-500">
              {tot.status} · {tot.currency}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {tot.amount.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              {tot.count} {t('commissions')}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('commissionsTitle')}</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('colDate')}</th>
                <th className="px-3 py-2 text-left">{t('colReferrer')}</th>
                <th className="px-3 py-2 text-left">{t('colOrder')}</th>
                <th className="px-3 py-2 text-right">{t('colAmount')}</th>
                <th className="px-3 py-2 text-left">{t('colStatus')}</th>
                <th className="px-3 py-2 text-left">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{c.referrer.name}</div>
                    <div className="text-xs text-slate-500">{c.referrer.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {c.orderId.slice(0, 10)}…
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {Number(c.amount).toFixed(2)} {c.currency}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ActionButtons
                      status={c.status}
                      busy={busyId === c.id}
                      onApprove={() => transition(c.id, 'APPROVED')}
                      onPay={() => transition(c.id, 'PAID')}
                      onReject={() => transition(c.id, 'REJECTED')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('referralsTitle')}</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('colDate')}</th>
                <th className="px-3 py-2 text-left">{t('colReferrer')}</th>
                <th className="px-3 py-2 text-left">{t('colReferred')}</th>
                <th className="px-3 py-2 text-left">{t('colCode')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{r.referrer.name}</div>
                    <div className="text-xs text-slate-500">{r.referrer.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{r.referred.name}</div>
                    <div className="text-xs text-slate-500">{r.referred.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ActionButtons(props: {
  status: Commission['status'];
  busy: boolean;
  onApprove: () => void;
  onPay: () => void;
  onReject: () => void;
}) {
  if (props.status === 'PAID' || props.status === 'REJECTED') return null;
  return (
    <div className="flex gap-1">
      {props.status === 'PENDING' && (
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onApprove}
          className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          Approve
        </button>
      )}
      {props.status === 'APPROVED' && (
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onPay}
          className="rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          Mark paid
        </button>
      )}
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onReject}
        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        Reject
      </button>
    </div>
  );
}
