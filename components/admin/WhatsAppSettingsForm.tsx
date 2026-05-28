'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { AdminCard } from '@/components/admin/AdminCard';

type Settings = {
  phone: string;
  defaultMessage: string;
  isEnabled: boolean;
  showFloating: boolean;
  showOnProduct: boolean;
};

type Props = { initial: Settings };

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ' +
        (checked ? 'bg-emerald-500' : 'bg-slate-300') +
        (disabled ? ' cursor-not-allowed opacity-60' : ' cursor-pointer')
      }
    >
      <span
        className={
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition ' +
          (checked ? 'translate-x-5' : 'translate-x-0.5')
        }
      />
    </button>
  );
}

export function WhatsAppSettingsForm({ initial }: Props) {
  const t = useTranslations('admin.whatsapp');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const [form, setForm] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: t('errorSave') });
        return;
      }
      setForm(json.data as Settings);
      setMessage({ type: 'success', text: t('saved') });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: t('errorSave') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard title={t('generalTitle')} description={t('generalSubtitle')}>
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t('enabledLabel')}
              </p>
              <p className="text-xs text-slate-500">{t('enabledHint')}</p>
            </div>
            <Toggle
              checked={form.isEnabled}
              onChange={(v) => update('isEnabled', v)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('phoneLabel')}
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="971500000000"
              disabled={saving}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">{t('phoneHint')}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('defaultMessageLabel')}
            </label>
            <textarea
              value={form.defaultMessage}
              onChange={(e) => update('defaultMessage', e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('defaultMessagePlaceholder')}
              disabled={saving}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('defaultMessageHint')}
            </p>
          </div>
        </div>
      </AdminCard>

      <AdminCard title={t('visibilityTitle')} description={t('visibilitySubtitle')}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t('showFloatingLabel')}
              </p>
              <p className="text-xs text-slate-500">
                {t('showFloatingHint')}
              </p>
            </div>
            <Toggle
              checked={form.showFloating}
              onChange={(v) => update('showFloating', v)}
              disabled={saving}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t('showOnProductLabel')}
              </p>
              <p className="text-xs text-slate-500">
                {t('showOnProductHint')}
              </p>
            </div>
            <Toggle
              checked={form.showOnProduct}
              onChange={(v) => update('showOnProduct', v)}
              disabled={saving}
            />
          </div>
        </div>
      </AdminCard>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={
            'rounded-lg border px-3 py-2 text-sm ' +
            (message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700')
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
    </form>
  );
}

