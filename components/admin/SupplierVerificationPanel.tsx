'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { AdminCard } from '@/components/admin/AdminCard';
import { useApiMutation } from '@/hooks/use-api';

type Tier = 'STANDARD' | 'VERIFIED' | 'GUARANTEED';

const TIERS: { value: Tier; tone: string }[] = [
  { value: 'STANDARD', tone: 'border-slate-300 text-slate-600' },
  { value: 'VERIFIED', tone: 'border-sky-400 text-sky-700' },
  { value: 'GUARANTEED', tone: 'border-amber-400 text-amber-700' }
];

/**
 * Real tier verification decision — routes through
 * lib/suppliers/verification.ts (approveTier/rejectSupplier) so tier,
 * verified/verifiedAt, and the append-only SupplierVerificationLog all
 * move together. This is what actually grants the trust badges buyers see.
 */
export function SupplierVerificationPanel({
  supplierId,
  currentTier,
  verificationExpiresAt
}: {
  supplierId: string;
  currentTier: Tier;
  verificationExpiresAt: string | null;
}) {
  const t = useTranslations('adminSuppliers');
  const [tier, setTier] = useState<Tier>(currentTier);
  const [expiresAt, setExpiresAt] = useState(
    verificationExpiresAt ? verificationExpiresAt.slice(0, 10) : ''
  );
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const review = useApiMutation<
    { action: 'approve' | 'reject'; tier?: Tier; note?: string; expiresAt?: string },
    { data: { tier: Tier; status: string } }
  >(`/api/admin/suppliers/${supplierId}/tier`, 'POST');

  async function handleApprove() {
    setNotice(null);
    try {
      const result = await review.mutate({
        action: 'approve',
        tier,
        note: note.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
      });
      setNotice(t('tierApplied', { tier: result.data.tier }));
    } catch {
      /* review.error rendered below */
    }
  }

  async function handleReject() {
    setNotice(null);
    try {
      await review.mutate({ action: 'reject', note: note.trim() || undefined });
      setTier('STANDARD');
      setNotice(t('verificationRejectedNotice'));
    } catch {
      /* review.error rendered below */
    }
  }

  return (
    <AdminCard title={t('sectionVerification')}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('grantTier')}
          </label>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTier(opt.value)}
                className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition ${
                  tier === opt.value
                    ? opt.tone + ' bg-white shadow-sm'
                    : 'border-transparent bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {t(`tier${opt.value}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {tier !== 'STANDARD' && (
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('verificationExpiresOptional')}
            </span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('internalNote')}
          </span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </label>

        {review.error && (
          <p className="text-xs font-medium text-rose-600">{review.error.message}</p>
        )}
        {notice && <p className="text-xs font-medium text-emerald-600">{notice}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={review.loading}
            onClick={handleApprove}
            className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {review.loading
              ? t('saving')
              : t('applyTierAction', { tier: t(`tier${tier}` as Parameters<typeof t>[0]) })}
          </button>
          <button
            type="button"
            disabled={review.loading}
            onClick={handleReject}
            className="rounded-lg border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            {t('rejectVerification')}
          </button>
        </div>
      </div>
    </AdminCard>
  );
}
