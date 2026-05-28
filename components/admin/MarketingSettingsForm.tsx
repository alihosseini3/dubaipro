'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Settings = {
  trackingEnabled: boolean;
  googleAdsId: string | null;
  googleConvLabel: string | null;
  metaPixelId: string | null;
  metaAccessTokenSet: boolean;
  metaTestEventCode: string | null;
  ga4MeasurementId: string | null;
  ga4ApiSecretSet: boolean;
  requireConsent: boolean;
};
type Patch = Partial<Settings & { metaAccessToken: string | null; ga4ApiSecret: string | null }>;

type Audiences = {
  viewedNotBought: number;
  cartAbandoned: number;
  previousBuyers: number;
};

type Issue = { field: string; message: string };

export function MarketingSettingsForm() {
  const t = useTranslations('admin.marketing');
  const [data, setData] = useState<Settings | null>(null);
  // Track edits to secret fields separately so empty input preserves
  // the persisted value rather than clearing it.
  const [secretEdits, setSecretEdits] = useState<{
    metaAccessToken: string;
    ga4ApiSecret: string;
  }>({ metaAccessToken: '', ga4ApiSecret: '' });
  const [audiences, setAudiences] = useState<Audiences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, a] = await Promise.all([
        fetch('/api/admin/marketing', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/admin/marketing/audiences', { cache: 'no-store' }).then((r) => r.json())
      ]);
      setData(s.data);
      setAudiences(a.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      const payload: Patch = {
        trackingEnabled: data.trackingEnabled,
        googleAdsId: data.googleAdsId,
        googleConvLabel: data.googleConvLabel,
        metaPixelId: data.metaPixelId,
        metaTestEventCode: data.metaTestEventCode,
        ga4MeasurementId: data.ga4MeasurementId,
        requireConsent: data.requireConsent,
        // Send secret only if user typed something. Empty string keeps
        // the persisted value untouched on the server side.
        ...(secretEdits.metaAccessToken
          ? { metaAccessToken: secretEdits.metaAccessToken }
          : {}),
        ...(secretEdits.ga4ApiSecret
          ? { ga4ApiSecret: secretEdits.ga4ApiSecret }
          : {})
      };
      const res = await fetch('/api/admin/marketing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: Issue[];
        data?: Settings;
      };
      if (!res.ok) {
        if (json.issues) setIssues(json.issues);
        throw new Error(json.error ?? `status ${res.status}`);
      }
      if (json.data) {
        setData(json.data);
        // Clear the in-memory secret inputs so the placeholder reflects
        // the new "•••••• Set" state.
        setSecretEdits({ metaAccessToken: '', ga4ApiSecret: '' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {t('loading')}
      </div>
    );
  }

  const issueFor = (f: string) => issues.find((i) => i.field === f)?.message;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('settingsTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('settingsSubtitle')}</p>
          </div>
          <Toggle
            checked={data.trackingEnabled}
            onChange={(v) => update('trackingEnabled', v)}
            label={data.trackingEnabled ? t('on') : t('off')}
          />
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label={t('googleAdsId')}
            hint={t('googleAdsIdHint')}
            value={data.googleAdsId ?? ''}
            onChange={(v) => update('googleAdsId', v || null)}
            placeholder="AW-1234567890"
            error={issueFor('googleAdsId')}
          />
          <Field
            label={t('googleConvLabel')}
            hint={t('googleConvLabelHint')}
            value={data.googleConvLabel ?? ''}
            onChange={(v) => update('googleConvLabel', v || null)}
            placeholder="abcDEF123"
          />
          <Field
            label={t('metaPixelId')}
            hint={t('metaPixelIdHint')}
            value={data.metaPixelId ?? ''}
            onChange={(v) => update('metaPixelId', v || null)}
            placeholder="123456789012345"
            error={issueFor('metaPixelId')}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">
            {t('serverTrackingTitle')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t('serverTrackingHint')}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label={t('metaAccessToken')}
              hint={t('metaAccessTokenHint')}
              value={secretEdits.metaAccessToken}
              onChange={(v) =>
                setSecretEdits((s) => ({ ...s, metaAccessToken: v }))
              }
              placeholder={data.metaAccessTokenSet ? t('secretSet') : t('secretEmpty')}
            />
            <Field
              label={t('metaTestEventCode')}
              hint={t('metaTestEventCodeHint')}
              value={data.metaTestEventCode ?? ''}
              onChange={(v) => update('metaTestEventCode', v || null)}
              placeholder="TEST12345"
            />
            <Field
              label={t('ga4MeasurementId')}
              hint={t('ga4MeasurementIdHint')}
              value={data.ga4MeasurementId ?? ''}
              onChange={(v) => update('ga4MeasurementId', v || null)}
              placeholder="G-XXXXXXXXXX"
              error={issueFor('ga4MeasurementId')}
            />
            <Field
              label={t('ga4ApiSecret')}
              hint={t('ga4ApiSecretHint')}
              value={secretEdits.ga4ApiSecret}
              onChange={(v) =>
                setSecretEdits((s) => ({ ...s, ga4ApiSecret: v }))
              }
              placeholder={data.ga4ApiSecretSet ? t('secretSet') : t('secretEmpty')}
            />
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md bg-slate-50 p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{t('requireConsent')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('requireConsentHint')}</p>
          </div>
          <Toggle
            checked={data.requireConsent}
            onChange={(v) => update('requireConsent', v)}
            label={data.requireConsent ? t('on') : t('off')}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </section>

      {audiences && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">{t('audiencesTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('audiencesSubtitle')}</p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <AudienceCard
              title={t('segments.viewedNotBought')}
              desc={t('segments.viewedNotBoughtDesc')}
              count={audiences.viewedNotBought}
              segment="viewedNotBought"
              t={t}
            />
            <AudienceCard
              title={t('segments.cartAbandoned')}
              desc={t('segments.cartAbandonedDesc')}
              count={audiences.cartAbandoned}
              segment="cartAbandoned"
              t={t}
            />
            <AudienceCard
              title={t('segments.previousBuyers')}
              desc={t('segments.previousBuyersDesc')}
              count={audiences.previousBuyers}
              segment="previousBuyers"
              t={t}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  error
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          'mt-1 w-full rounded-md border px-3 py-1.5 font-mono text-sm ' +
          (error ? 'border-red-300' : 'border-slate-300')
        }
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition ' +
        (checked
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
      }
      aria-pressed={checked}
    >
      <span
        className={
          'h-2 w-2 rounded-full ' + (checked ? 'bg-emerald-500' : 'bg-slate-400')
        }
      />
      {label}
    </button>
  );
}

function AudienceCard({
  title,
  desc,
  count,
  segment,
  t
}: {
  title: string;
  desc: string;
  count: number;
  segment: 'viewedNotBought' | 'cartAbandoned' | 'previousBuyers';
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500">{desc}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
        {count.toLocaleString()}
      </p>
      <a
        href={`/api/admin/marketing/audiences?format=csv&segment=${segment}`}
        className="mt-2 inline-block text-xs font-medium text-slate-700 hover:underline"
      >
        {t('downloadHashed')}
      </a>
    </div>
  );
}
