'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type AccountInfo = {
  bankName: string;
  accountHolder: string;
  reference: string;
  notes?: string;
};

type Props = {
  paymentId: string;
  methodCode: 'CARD_TRANSFER' | 'BANK_TRANSFER';
  orderId: string;
  locale: string;
  amount: number;
  currency: string;
  initialReference: string | null;
  initialReceipt: string | null;
};

/**
 * Manual-payment confirmation step.
 *
 * Shows the bank/card account info read from server env via
 * /api/payment/manual-info, then accepts a tracking number AND/OR a
 * receipt-image URL (uploaded via the existing image upload pipeline).
 * Submitting POSTs /api/payment/manual which flips the Payment row to
 * MANUAL_REVIEW for admin verification.
 */
export function ManualPaymentClient({
  paymentId,
  methodCode,
  orderId,
  locale,
  amount,
  currency,
  initialReference,
  initialReceipt
}: Props) {
  const t = useTranslations('payment');
  const tm = useTranslations('checkout.methods');
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [reference, setReference] = useState(initialReference ?? '');
  const [receipt, setReceipt] = useState(initialReceipt ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/payment/manual-info?code=${methodCode}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { data: AccountInfo };
        if (alive) setInfo(json.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [methodCode]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/payment/receipt-upload', {
        method: 'POST',
        body: fd
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { url?: string };
        error?: string;
      };
      if (!res.ok || !json.data?.url) {
        throw new Error(json.error ?? 'upload_failed');
      }
      setReceipt(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reference.trim() && !receipt) {
      setError(t('manualRequireOne'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payment/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          referenceNumber: reference.trim() || null,
          receiptImage: receipt || null
        })
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? 'submit_failed');
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.href = `/${locale}/orders/${orderId}`;
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed');
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          {tm(`${methodCode === 'CARD_TRANSFER' ? 'cardTransfer' : 'bankTransfer'}.label`)}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {tm(`${methodCode === 'CARD_TRANSFER' ? 'cardTransfer' : 'bankTransfer'}.desc`)}
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">{t('amountToTransfer')}</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {amount.toFixed(2)} {currency}
            </span>
            <button
              type="button"
              onClick={() => copy(amount.toFixed(2))}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {t('copy')}
            </button>
          </div>
        </div>

        {info ? (
          <dl className="mt-4 space-y-2 text-sm">
            <Row k={t('bankName')} v={info.bankName} />
            <Row k={t('accountHolder')} v={info.accountHolder} />
            <Row
              k={
                methodCode === 'CARD_TRANSFER'
                  ? t('cardNumber')
                  : t('iban')
              }
              v={info.reference}
              copyable
              onCopy={() => copy(info.reference)}
            />
            {info.notes && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {info.notes}
              </p>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-xs text-slate-500">{t('loadingInfo')}</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-slate-900">
          {t('confirmTitle')}
        </h3>
        <p className="text-xs text-slate-500">{t('confirmHint')}</p>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('referenceNumber')}
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('referenceHint')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            maxLength={128}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('receiptImage')}
          </label>
          {receipt ? (
            <div className="flex items-start gap-3">
              <SmartImage
                src={receipt}
                alt="receipt"
                className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                style={{ width: 96, height: 96 }}
              />
              <button
                type="button"
                onClick={() => setReceipt('')}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                {t('removeReceipt')}
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-xs file:me-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
          )}
          {uploading && (
            <p className="mt-1 text-xs text-slate-500">{t('uploading')}</p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs font-medium text-emerald-600">
            {t('submittedRedirecting')}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || uploading || success}
          className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? t('submitting') : t('submitForReview')}
        </button>
      </form>
    </div>
  );
}

function Row({
  k,
  v,
  copyable,
  onCopy
}: {
  k: string;
  v: string;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="flex items-center gap-2">
        <code className="font-mono text-sm text-slate-900">{v}</code>
        {copyable && (
          <button
            type="button"
            onClick={onCopy}
            className="text-[11px] font-semibold text-indigo-600 hover:underline"
          >
            copy
          </button>
        )}
      </dd>
    </div>
  );
}
