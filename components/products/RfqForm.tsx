'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type RfqFormProps = {
  productId: string;
  defaultQuantity?: number;
};

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function RfqForm({ productId, defaultQuantity = 1 }: RfqFormProps) {
  const t = useTranslations('rfq');
  const [quantity, setQuantity] = useState<number>(defaultQuantity);
  const [message, setMessage] = useState<string>('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!Number.isInteger(quantity) || quantity < 1) {
      setState({ kind: 'error', message: t('errorQuantity') });
      return;
    }

    setState({ kind: 'submitting' });

    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          quantity,
          message: message.trim() || undefined
        })
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Request failed: ${res.status}`);
      }

      setState({ kind: 'success' });
      setMessage('');
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : t('errorGeneric')
      });
    }
  }

  if (state.kind === 'success') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <h2 className="text-lg font-semibold text-emerald-800">
          {t('successTitle')}
        </h2>
        <p className="mt-2 text-sm text-emerald-700">{t('successMessage')}</p>
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          {t('submitAnother')}
        </button>
      </div>
    );
  }

  const isSubmitting = state.kind === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      noValidate
    >
      <div>
        <label
          htmlFor="rfq-quantity"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {t('quantity')} <span className="text-red-500">*</span>
        </label>
        <input
          id="rfq-quantity"
          type="number"
          min={1}
          step={1}
          required
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          disabled={isSubmitting}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
        />
        <p className="mt-1 text-xs text-slate-500">{t('quantityHint')}</p>
      </div>

      <div>
        <label
          htmlFor="rfq-message"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {t('message')}
        </label>
        <textarea
          id="rfq-message"
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isSubmitting}
          placeholder={t('messagePlaceholder')}
          className="block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
        />
      </div>

      {/* Future: file upload */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-400">
        {t('attachmentsComingSoon')}
      </div>

      {state.kind === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? t('submitting') : t('submit')}
      </button>

      <p className="text-[11px] leading-relaxed text-slate-400">
        {t('privacyNote')}
      </p>
    </form>
  );
}
