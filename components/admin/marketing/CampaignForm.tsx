'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type FormValues = {
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  subject: string;
  body: string;
  segment: string;
  couponCode: string;
  scheduledAt: string;
};

type Props = {
  initial?: Partial<FormValues> & { id?: string };
  onSaved: () => void;
  onCancel: () => void;
};

const SEGMENTS = [
  { value: '', labelKey: 'segmentAll' },
  { value: 'NEW', labelKey: 'segmentNew' },
  { value: 'REPEAT', labelKey: 'segmentRepeat' },
  { value: 'HIGH_VALUE', labelKey: 'segmentHighValue' },
  { value: 'INACTIVE', labelKey: 'segmentInactive' },
] as const;

export function CampaignForm({ initial, onSaved, onCancel }: Props) {
  const t = useTranslations('admin.campaigns');
  const isEdit = Boolean(initial?.id);

  const [form, setForm] = useState<FormValues>({
    name: initial?.name ?? '',
    channel: initial?.channel ?? 'EMAIL',
    subject: initial?.subject ?? '',
    body: initial?.body ?? '',
    segment: initial?.segment ?? '',
    couponCode: initial?.couponCode ?? '',
    scheduledAt: initial?.scheduledAt ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audienceSize, setAudienceSize] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function set<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function previewAudience() {
    setPreviewLoading(true);
    try {
      const seg = form.segment || 'ALL';
      const res = await fetch(
        `/api/admin/marketing/segments?preview=${seg}`,
      );
      const json = await res.json();
      setAudienceSize(json.data?.length ?? 0);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        channel: form.channel,
        subject: form.channel === 'EMAIL' ? form.subject : undefined,
        body: form.body,
        segment: form.segment || null,
        couponCode: form.couponCode || null,
        scheduledAt: form.scheduledAt || null,
      };

      const url = isEdit
        ? `/api/admin/marketing/campaigns/${initial!.id}`
        : '/api/admin/marketing/campaigns';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'error');
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 transition-all placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/20';
  const labelCls = 'block text-[12px] font-semibold text-slate-600 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-[17px] font-semibold text-slate-900">
        {t('formTitle')}
      </h2>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Name */}
      <div>
        <label className={labelCls}>{t('formStep1')}</label>
        <input
          required
          className={inputCls}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Summer sale 2026…"
        />
      </div>

      {/* Channel */}
      <div>
        <label className={labelCls}>{t('channel')}</label>
        <div className="flex gap-3">
          {(['EMAIL', 'WHATSAPP'] as const).map((ch) => (
            <label
              key={ch}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-colors',
                form.channel === ch
                  ? 'border-orange-400 bg-orange-50 text-orange-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              ].join(' ')}
            >
              <input
                type="radio"
                className="sr-only"
                value={ch}
                checked={form.channel === ch}
                onChange={() => set('channel', ch)}
              />
              {ch === 'EMAIL' ? t('channelEmail') : t('channelWhatsapp')}
            </label>
          ))}
        </div>
      </div>

      {/* Subject (email only) */}
      {form.channel === 'EMAIL' && (
        <div>
          <label className={labelCls}>{t('subject')}</label>
          <input
            required
            className={inputCls}
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
          />
        </div>
      )}

      {/* Body */}
      <div>
        <label className={labelCls}>{t('body')}</label>
        <textarea
          required
          rows={6}
          className={inputCls}
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">{t('bodyHint')}</p>
      </div>

      {/* Coupon */}
      <div>
        <label className={labelCls}>{t('couponCode')}</label>
        <input
          className={inputCls}
          value={form.couponCode}
          onChange={(e) => set('couponCode', e.target.value)}
          placeholder="SUMMER20"
        />
      </div>

      {/* Segment */}
      <div>
        <label className={labelCls}>{t('segment')}</label>
        <select
          className={inputCls}
          value={form.segment}
          onChange={(e) => set('segment', e.target.value)}
        >
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.labelKey)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={previewAudience}
          disabled={previewLoading}
          className="mt-1.5 text-[12px] font-medium text-orange-600 hover:underline disabled:opacity-50"
        >
          {previewLoading ? '…' : t('previewAudience')}
        </button>
        {audienceSize !== null && (
          <span className="ml-2 text-xs text-slate-500">
            {t('audienceSize', { count: audienceSize })}
          </span>
        )}
      </div>

      {/* Schedule */}
      <div>
        <label className={labelCls}>{t('scheduledAt')}</label>
        <input
          type="datetime-local"
          className={inputCls}
          value={form.scheduledAt}
          onChange={(e) => set('scheduledAt', e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-orange-500 px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-6 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
