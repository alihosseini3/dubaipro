'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SupplierOnboardingStatus } from '@prisma/client';

import { AdminCard } from '@/components/admin/AdminCard';

type Props = {
  locale: string;
  supplierId: string;
  onboardingStatus: SupplierOnboardingStatus;
  accountStatus: string;
  verified: boolean;
  canListProducts: boolean;
};

const ONBOARDING_STATUSES: SupplierOnboardingStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];
const ACCOUNT_STATUSES = ['ACTIVE', 'PENDING_REVIEW', 'SUSPENDED', 'BLACKLISTED'];

export function SupplierApplicationActions({
  locale,
  supplierId,
  onboardingStatus: initOnboarding,
  accountStatus: initAccount,
  verified: initVerified,
  canListProducts: initCanList,
}: Props) {
  const t = useTranslations('adminSuppliers');
  const router = useRouter();

  const [onboardingStatus, setOnboardingStatus] = useState(initOnboarding);
  const [accountStatus, setAccountStatus]       = useState(initAccount);
  const [verified, setVerified]                 = useState(initVerified);
  const [canList, setCanList]                   = useState(initCanList);
  const [saving, setSaving]                     = useState(false);
  const [msg, setMsg]                           = useState<{ ok: boolean; text: string } | null>(null);
  const [rejectReason, setRejectReason]         = useState('');

  async function patch(payload: Record<string, unknown>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/supplier-applications/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((json.error as string) ?? t('actionFailed'));
      setMsg({ ok: true, text: t('actionSuccess') });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('actionFailed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard title={t('sectionStatus')}>
      <div className="space-y-5">
        {/* Onboarding status */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            {t('changeOnboarding')}
          </label>
          <div className="flex flex-wrap gap-2">
            {ONBOARDING_STATUSES.map((s) => (
              <button
                key={s}
                disabled={saving || onboardingStatus === s}
                onClick={() => {
                  if (s === 'REJECTED' && !rejectReason) {
                    const reason = window.prompt(t('rejectReason') ?? 'Reason (optional)') ?? '';
                    setRejectReason(reason);
                    setOnboardingStatus(s);
                    void patch({ onboardingStatus: s, rejectReason: reason });
                  } else {
                    setOnboardingStatus(s);
                    void patch({ onboardingStatus: s });
                  }
                }}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  onboardingStatus === s
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40',
                ].join(' ')}
              >
                {t(`status${s}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {/* Account status */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            {t('changeStatus')}
          </label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_STATUSES.map((s) => (
              <button
                key={s}
                disabled={saving || accountStatus === s}
                onClick={() => {
                  setAccountStatus(s);
                  void patch({ accountStatus: s });
                }}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  accountStatus === s
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40',
                ].join(' ')}
              >
                {t(`account${s}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Toggles */}
        <div className="space-y-3">
          <Toggle
            label={t('verifiedToggle')}
            checked={verified}
            disabled={saving}
            onChange={(v) => {
              setVerified(v);
              void patch({ verified: v });
            }}
          />
          <Toggle
            label={t('allowProductsToggle')}
            checked={canList}
            disabled={saving}
            onChange={(v) => {
              setCanList(v);
              void patch({ canListProducts: v });
            }}
          />
        </div>

        {/* Feedback */}
        {saving && (
          <p className="text-xs text-slate-500">{t('saving')}</p>
        )}
        {msg && (
          <p className={`text-xs font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </AdminCard>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 flex-none rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-orange-500' : 'bg-slate-200',
          'disabled:opacity-40',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  );
}
