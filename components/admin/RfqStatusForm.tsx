'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, Select, SubmitButton } from './AdminForm';

type RfqStatusFormProps = {
  rfqId: string;
  currentStatus: string;
};

const STATUSES = ['OPEN', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CLOSED'] as const;

export function RfqStatusForm({ rfqId, currentStatus }: RfqStatusFormProps) {
  const t = useTranslations('admin.rfqs');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch(`/api/rfq/${rfqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
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
      <SubmitButton
        label={tCommon('update')}
        pendingLabel={tCommon('updating')}
        pending={pending || status === currentStatus}
      />
    </form>
  );
}
