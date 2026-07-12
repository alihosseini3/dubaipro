import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { SupplierOnboardingStatus, SupplierStatus } from '@prisma/client';

import { canSubmitProducts, type GateReason } from '@/lib/suppliers/gating';
import { getLatestReview } from '@/lib/suppliers/onboarding';

type Props = {
  locale: string;
  supplierId: string;
  onboardingStatus: SupplierOnboardingStatus;
  status: SupplierStatus;
  canListProducts: boolean;
};

const TONE: Record<GateReason, string> = {
  not_submitted: 'border-amber-200 bg-amber-50 text-amber-900',
  pending_review: 'border-sky-200 bg-sky-50 text-sky-900',
  rejected: 'border-rose-200 bg-rose-50 text-rose-900',
  not_granted: 'border-slate-200 bg-slate-50 text-slate-800',
  suspended: 'border-rose-200 bg-rose-50 text-rose-900',
  blacklisted: 'border-rose-200 bg-rose-50 text-rose-900'
};

/**
 * Explains exactly why a supplier can't publish yet, and what to do next.
 *
 * Renders nothing once the gate is open, so it can be dropped at the top of
 * any supplier dashboard page. The copy mirrors lib/suppliers/gating.ts —
 * that module is the enforcement; this is the human-readable half.
 */
export async function ApplicationStatusBanner({
  locale,
  supplierId,
  onboardingStatus,
  status,
  canListProducts
}: Props) {
  const gate = canSubmitProducts({ onboardingStatus, status, canListProducts });
  if (gate.allowed) return null;

  const t = await getTranslations({ locale, namespace: 'supplier.applicationStatus' });

  // The rejection reason lives on the latest SupplierVerification row.
  const review = gate.reason === 'rejected' ? await getLatestReview(supplierId) : null;

  const ctaHref =
    gate.reason === 'not_submitted' || gate.reason === 'rejected'
      ? `/${locale}/supplier/register`
      : null;

  return (
    <div className={`rounded-2xl border p-4 ${TONE[gate.reason]}`}>
      <p className="text-sm font-bold">
        {t(`${gate.reason}Title` as Parameters<typeof t>[0])}
      </p>
      <p className="mt-1 text-sm opacity-90">
        {t(`${gate.reason}Body` as Parameters<typeof t>[0])}
      </p>

      {review?.notes && (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
          <span className="font-semibold">{t('rejectionReason')}:</span> {review.notes}
        </p>
      )}

      {ctaHref && (
        <Link
          href={ctaHref}
          className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          {gate.reason === 'rejected' ? t('fixAndResubmit') : t('completeApplication')}
        </Link>
      )}
    </div>
  );
}
