'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useApiMutation } from '@/hooks/use-api';

type Props = {
  locale: string;
  productId: string;
  supplierName: string;
  /** wa.me digits, when the supplier has a usable phone. */
  whatsappPhone: string | null;
  isAuthenticated: boolean;
};

type Modal = 'inquiry' | 'sample' | null;

const FIELD =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none';

/**
 * The B2B contact strip on the product page: Chat, Send Inquiry, Request
 * Sample, WhatsApp. Every path lands in the unified messaging inbox — no
 * RFQ, no checkout.
 */
export function ContactSupplierPanel({
  locale,
  productId,
  supplierName,
  whatsappPhone,
  isAuthenticated
}: Props) {
  const t = useTranslations('contactSupplier');
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);

  const startChat = useApiMutation<{ productId: string }, { data: { id: string } }>(
    '/api/conversations',
    'POST'
  );
  const sendInquiry = useApiMutation<
    { productId: string; quantity: number; unit: string; message: string },
    { data: { id: string } }
  >('/api/inquiries', 'POST');
  const requestSample = useApiMutation<
    { productId: string; quantity: number; message?: string },
    { data: { conversationId: string | null } }
  >('/api/samples', 'POST');

  const [quantity, setQuantity] = useState('100');
  const [unit, setUnit] = useState('pieces');
  const [message, setMessage] = useState('');

  const loginRedirect = () =>
    router.push(
      `/${locale}/login?from=${encodeURIComponent(`/${locale}/products`)}`
    );

  async function handleChat() {
    if (!isAuthenticated) return loginRedirect();
    try {
      const result = await startChat.mutate({ productId });
      router.push(`/${locale}/account/messages/${result.data.id}`);
    } catch {
      /* startChat.error rendered below */
    }
  }

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await sendInquiry.mutate({
        productId,
        quantity: Math.max(1, Number(quantity) || 1),
        unit: unit.trim() || 'pieces',
        message: message.trim()
      });
      router.push(`/${locale}/account/messages/${result.data.id}`);
    } catch {
      /* sendInquiry.error rendered below */
    }
  }

  async function handleSample(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await requestSample.mutate({
        productId,
        quantity: Math.max(1, Number(quantity) || 1),
        ...(message.trim() ? { message: message.trim() } : {})
      });
      router.push(
        result.data.conversationId
          ? `/${locale}/account/messages/${result.data.conversationId}`
          : `/${locale}/account/samples`
      );
    } catch {
      /* requestSample.error rendered below */
    }
  }

  function openModal(which: Exclude<Modal, null>) {
    if (!isAuthenticated) return loginRedirect();
    setMessage('');
    setQuantity(which === 'sample' ? '1' : '100');
    setModal(which);
  }

  const activeError = startChat.error ?? sendInquiry.error ?? requestSample.error;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {t('title', { supplier: supplierName })}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={startChat.loading}
          onClick={handleChat}
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          💬 {t('chat')}
        </button>
        <button
          type="button"
          onClick={() => openModal('inquiry')}
          className="rounded-xl border-2 border-orange-500 px-4 py-2.5 text-sm font-bold text-orange-600 hover:bg-orange-50"
        >
          📩 {t('inquiry')}
        </button>
        <button
          type="button"
          onClick={() => openModal('sample')}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          📦 {t('sample')}
        </button>
        {whatsappPhone ? (
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-emerald-300 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            🟢 {t('whatsapp')}
          </a>
        ) : (
          <span className="rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-center text-sm text-slate-300">
            🟢 {t('whatsapp')}
          </span>
        )}
      </div>

      {activeError && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {activeError.message}
        </p>
      )}

      {/* Inquiry / sample modal */}
      {modal && (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">
              {modal === 'inquiry' ? t('inquiryTitle') : t('sampleTitle')}
            </p>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <form
            onSubmit={modal === 'inquiry' ? handleInquiry : handleSample}
            className="mt-2 space-y-2"
          >
            <div className="flex gap-2">
              <label className="block flex-1">
                <span className="text-xs text-slate-500">{t('quantity')}</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`mt-0.5 ${FIELD}`}
                />
              </label>
              {modal === 'inquiry' && (
                <label className="block flex-1">
                  <span className="text-xs text-slate-500">{t('unit')}</span>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
              )}
            </div>
            <label className="block">
              <span className="text-xs text-slate-500">{t('message')}</span>
              <textarea
                rows={3}
                required={modal === 'inquiry'}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  modal === 'inquiry'
                    ? t('inquiryPlaceholder')
                    : t('samplePlaceholder')
                }
                className={`mt-0.5 ${FIELD}`}
              />
            </label>
            <button
              type="submit"
              disabled={sendInquiry.loading || requestSample.loading}
              className="w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {sendInquiry.loading || requestSample.loading ? t('sending') : t('send')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
