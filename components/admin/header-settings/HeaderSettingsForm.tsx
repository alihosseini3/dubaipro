'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { HeaderSettingsDTO } from '@/lib/header/service';
import { ImageUpload } from '@/components/ui/ImageUpload';

type Props = {
  initial: HeaderSettingsDTO;
};

/**
 * General-settings form for the header (logo, phone, top-bar text,
 * visibility toggles, CTA). Each field is independently optimistic-
 * updated locally; saving PUTs the whole form to the API and triggers
 * `router.refresh()` so the public site reflects the change on the
 * next navigation.
 */
export function HeaderSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<HeaderSettingsDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function set<K extends keyof HeaderSettingsDTO>(key: K, value: HeaderSettingsDTO[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/header/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('save_failed');
      setSavedAt(Date.now());
      startTransition(() => router.refresh());
    } catch {
      setError('Could not save header settings. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">General</h2>
          <p className="text-sm text-slate-500">
            Logo, phone, slogan and CTA shown across the public header.
          </p>
        </div>
        {savedAt && !saving && !error && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Saved
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="col-span-full">
          <ImageUpload
            label="Logo"
            hint="Optional. Leave empty to render the wordmark."
            value={form.logoUrl ?? null}
            onChange={(url) => set('logoUrl', url)}
            uploadFolder="general"
            uploadContext="brand"
          />
        </div>

        <Field label="Logo text" hint="Wordmark fallback when no image is set.">
          <input
            type="text"
            value={form.logoText}
            onChange={(e) => set('logoText', e.target.value)}
            maxLength={64}
            className={inputCls}
          />
        </Field>

        <Field label="Phone number" hint="Shown in the top bar; empty hides it.">
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            placeholder="+971 4 000 0000"
            className={inputCls}
          />
        </Field>

        <Field label="Top-bar text">
          <input
            type="text"
            value={form.topbarText}
            onChange={(e) => set('topbarText', e.target.value)}
            maxLength={200}
            className={inputCls}
          />
        </Field>

        <Field label="CTA label" hint="Right-side button on the nav bar.">
          <input
            type="text"
            value={form.ctaLabel}
            onChange={(e) => set('ctaLabel', e.target.value)}
            maxLength={64}
            className={inputCls}
          />
        </Field>

        <Field label="CTA href">
          <input
            type="text"
            value={form.ctaHref}
            onChange={(e) => set('ctaHref', e.target.value)}
            placeholder="/contact?type=quote"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Toggle
          label="Show top bar"
          description="The dark utility bar above the main header."
          checked={form.showTopBar}
          onChange={(v) => set('showTopBar', v)}
        />
        <Toggle
          label="Show search"
          description="Center search field on the main header."
          checked={form.showSearch}
          onChange={(v) => set('showSearch', v)}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-xl border p-3 text-start transition ${
        checked
          ? 'border-orange-300 bg-orange-50/50'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-orange-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}
