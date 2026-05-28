'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ShippingSettingsDTO } from '@/types/shipping';

type Props = { initial: ShippingSettingsDTO };

export function ShippingSettingsCard({ initial }: Props) {
  const t = useTranslations('admin.shipping');
  const [factor, setFactor] = useState(String(initial.defaultVolumetricFactor));
  const [enabled, setEnabled] = useState(initial.enableVolumetric);
  const [rounding, setRounding] = useState<'ceil' | 'round'>(initial.roundingStrategy);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/shipping/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultVolumetricFactor: Number(factor) || 5000,
          enableVolumetric: enabled,
          roundingStrategy: rounding
        })
      });
      if (!res.ok) throw new Error();
      setMsg(t('settingsSaved'));
    } catch {
      setMsg(t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          {t('settingsFactor')}
        </label>
        <input
          type="number"
          min="1000"
          step="100"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-slate-400">{t('settingsFactorHint')}</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">
          {t('settingsRounding')}
        </label>
        <select
          value={rounding}
          onChange={(e) => setRounding(e.target.value as 'ceil' | 'round')}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="ceil">{t('settingsRoundingCeil')}</option>
          <option value="round">{t('settingsRoundingRound')}</option>
        </select>
      </div>
      <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-slate-900"
        />
        {t('settingsEnableVolumetric')}
      </label>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          {saving ? t('saving') : t('save')}
        </button>
        {msg && <span className="text-xs text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
