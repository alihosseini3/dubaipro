'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, Select, SubmitButton, TextInput } from './AdminForm';

type OrderStatusFormProps = {
  orderId: string;
  currentStatus: string;
  currentTrackingCode?: string | null;
  currentCarrier?: string | null;
};

const STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
] as const;

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentTrackingCode,
  currentCarrier
}: OrderStatusFormProps) {
  const t = useTranslations('admin.orders');
  const tCommon = useTranslations('admin.common');
  const tTrack = useTranslations('tracking');
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [trackingCode, setTrackingCode] = useState(currentTrackingCode ?? '');
  const [carrier, setCarrier] = useState(currentCarrier ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty =
    status !== currentStatus ||
    trackingCode !== (currentTrackingCode ?? '') ||
    carrier !== (currentCarrier ?? '');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          trackingCode: trackingCode.trim() || null,
          carrier: carrier.trim() || null
        })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      setSuccess(t('statusUpdateSuccess'));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <FormMessage type="error">{error}</FormMessage>}
      {success && <FormMessage type="success">{success}</FormMessage>}
      <Select
        name="status"
        label={t('changeStatus')}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        options={STATUSES.map((s) => ({ value: s, label: s }))}
      />
      <TextInput
        name="carrier"
        label={tTrack('carrier')}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        maxLength={64}
        placeholder="Aramex, DHL, ..."
      />
      <TextInput
        name="trackingCode"
        label={tTrack('trackingCode')}
        value={trackingCode}
        onChange={(e) => setTrackingCode(e.target.value)}
        maxLength={64}
        placeholder="1Z999AA10123456784"
      />
      <SubmitButton
        label={tCommon('update')}
        pendingLabel={tCommon('updating')}
        pending={pending || !dirty}
      />
    </form>
  );
}
