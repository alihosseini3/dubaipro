'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Row = {
  id: string;
  orderId: string;
  amount: string | number;
  currency: string;
  status: string;
  provider: string;
  method: string | null;
  providerId: string | null;
  referenceNumber: string | null;
  receiptImage: string | null;
  errorMessage: string | null;
  createdAt: string;
  order: {
    id: string;
    totalPrice: string | number;
    status: string;
    user: { email: string | null; name: string | null } | null;
  };
};

const STATUSES = [
  '',
  'PENDING',
  'PROCESSING',
  'MANUAL_REVIEW',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED'
];

const METHODS = [
  '',
  'STRIPE',
  'TAP',
  'PAYPAL',
  'MELLAT',
  'ZARINPAL',
  'CARD_TRANSFER',
  'BANK_TRANSFER'
];

export function AdminPaymentsList() {
  const t = useTranslations('admin.payments');
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (method) params.set('method', method);
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        cache: 'no-store'
      });
      const json = (await res.json()) as { data: Row[] };
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method]);

  async function action(id: string, kind: 'approve' | 'reject') {
    let body: Record<string, unknown> | undefined;
    if (kind === 'reject') {
      const reason = prompt(t('rejectReason')) ?? '';
      body = { reason };
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payments/${id}/${kind}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message ?? err.error ?? 'failed');
      } else {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('filterStatus')}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || t('any')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('filterMethod')}
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m || t('any')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('search')}
          </label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <button
              type="button"
              onClick={() => load()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              {t('go')}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2 text-start">{t('colDate')}</th>
                <th className="p-2 text-start">{t('colMethod')}</th>
                <th className="p-2 text-start">{t('colStatus')}</th>
                <th className="p-2 text-start">{t('colCustomer')}</th>
                <th className="p-2 text-end">{t('colAmount')}</th>
                <th className="p-2 text-start">{t('colReceipt')}</th>
                <th className="p-2 text-end">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-2 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {r.method ?? r.provider}
                    </code>
                  </td>
                  <td className="p-2">
                    <StatusBadge status={r.status} />
                    {r.errorMessage && (
                      <div className="mt-0.5 text-[11px] text-red-600">
                        {r.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    <div className="font-medium text-slate-900">
                      {r.order.user?.name ?? '—'}
                    </div>
                    <div className="text-slate-500">
                      {r.order.user?.email ?? ''}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      #{r.orderId.slice(-8).toUpperCase()}
                    </div>
                  </td>
                  <td className="p-2 text-end font-semibold">
                    {Number(r.amount).toFixed(2)} {r.currency}
                  </td>
                  <td className="p-2">
                    {r.receiptImage ? (
                      <a
                        href={r.receiptImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <SmartImage
                          src={r.receiptImage}
                          alt="receipt"
                          style={{ width: 48, height: 48 }}
                          className="h-12 w-12 rounded border border-slate-200 object-cover"
                        />
                      </a>
                    ) : null}
                    {r.referenceNumber && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        Ref:{' '}
                        <code className="rounded bg-slate-100 px-1">
                          {r.referenceNumber}
                        </code>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-end">
                    {r.status === 'MANUAL_REVIEW' ||
                    r.status === 'PROCESSING' ||
                    r.status === 'PENDING' ? (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => action(r.id, 'approve')}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {t('approve')}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => action(r.id, 'reject')}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {t('reject')}
                        </button>
                      </div>
                    ) : null}
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

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'PAID'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'FAILED' || status === 'CANCELLED'
        ? 'bg-red-100 text-red-700'
        : status === 'MANUAL_REVIEW'
          ? 'bg-amber-100 text-amber-800'
          : status === 'REFUNDED'
            ? 'bg-slate-100 text-slate-600'
            : 'bg-blue-100 text-blue-700';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${tone}`}>
      {status}
    </span>
  );
}
