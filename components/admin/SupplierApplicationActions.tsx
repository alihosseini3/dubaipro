'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SupplierOnboardingStatus } from '@prisma/client';

import { AdminCard } from '@/components/admin/AdminCard';
import { useApiMutation } from '@/hooks/use-api';

type Props = {
  supplierId: string;
  onboardingStatus: SupplierOnboardingStatus;
  accountStatus: string;
  canListProducts: boolean;
};

/** Account-level controls that stay independent of the application decision. */
const ACCOUNT_STATUSES = ['ACTIVE', 'PENDING_REVIEW', 'SUSPENDED', 'BLACKLISTED'];

const ONBOARDING_TONE: Record<SupplierOnboardingStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700'
};

/**
 * Application review + account status.
 *
 * The approve/reject decision is one atomic call to
 * /api/admin/supplier-applications/[id]/review — approving grants product
 * listing rights, resolves the verification request, writes the audit trail,
 * and notifies the supplier. The old manual `verified` and `canListProducts`
 * toggles are gone: `verified`/tier is owned by SupplierVerificationPanel, and
 * listing rights are now a consequence of approval.
 */
export function SupplierApplicationActions({
  supplierId,
  onboardingStatus: initOnboarding,
  accountStatus: initAccount,
  canListProducts: initCanList
}: Props) {
  const t = useTranslations('adminSuppliers');
  const router = useRouter();

  const [onboarding, setOnboarding] = useState(initOnboarding);
  const [accountStatus, setAccountStatus] = useState(initAccount);
  const [canList, setCanList] = useState(initCanList);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const review = useApiMutation<
    { action: 'approve' | 'reject'; reason?: string },
    {
      data: {
        onboardingStatus: SupplierOnboardingStatus;
        status: string;
        canListProducts: boolean;
      };
    }
  >(`/api/admin/supplier-applications/${supplierId}/review`, 'POST');

  const patchStatus = useApiMutation<{ accountStatus: string }, unknown>(
    `/api/admin/supplier-applications/${supplierId}`,
    'PATCH'
  );

  async function decide(action: 'approve' | 'reject') {
    setNotice(null);
    try {
      const result = await review.mutate(
        action === 'reject' ? { action, reason: reason.trim() } : { action }
      );
      setOnboarding(result.data.onboardingStatus);
      setAccountStatus(result.data.status);
      setCanList(result.data.canListProducts);
      setRejecting(false);
      setReason('');
      setNotice(action === 'approve' ? t('approvedNotice') : t('rejectedNotice'));
      router.refresh();
    } catch {
      /* review.error rendered below */
    }
  }

  async function changeAccountStatus(next: string) {
    setNotice(null);
    try {
      await patchStatus.mutate({ accountStatus: next });
      setAccountStatus(next);
      setNotice(t('actionSuccess'));
      router.refresh();
    } catch {
      /* patchStatus.error rendered below */
    }
  }

  const busy = review.loading || patchStatus.loading;
  const error = review.error ?? patchStatus.error;

  return (
    <AdminCard title={t('sectionStatus')}>
      <div className="space-y-5">
        {/* Current application state */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${ONBOARDING_TONE[onboarding]}`}
          >
            {t(`status${onboarding}` as Parameters<typeof t>[0])}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              canList ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {canList ? t('listingGranted') : t('listingNotGranted')}
          </span>
        </div>

        {/* The atomic decision */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('applicationDecision')}
          </p>
          <p className="mb-3 text-xs text-slate-500">{t('approveHint')}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || onboarding === 'APPROVED'}
              onClick={() => decide('approve')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              {review.loading ? t('saving') : t('approveApplication')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting((v) => !v)}
              className="rounded-lg border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
            >
              {t('rejectApplication')}
            </button>
          </div>

          {rejecting && (
            <div className="mt-2 space-y-2">
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('rejectReason')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || reason.trim().length < 3}
                onClick={() => decide('reject')}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
              >
                {t('confirmReject')}
              </button>
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Account status — independent of the application decision */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('changeStatus')}
          </label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || accountStatus === s}
                onClick={() => changeAccountStatus(s)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  accountStatus === s
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40'
                ].join(' ')}
              >
                {t(`account${s}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs font-medium text-rose-600">{error.message}</p>}
        {notice && <p className="text-xs font-medium text-emerald-600">{notice}</p>}
      </div>
    </AdminCard>
  );
}
