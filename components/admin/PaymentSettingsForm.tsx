'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type PublicSettings = {
  id: string;
  enableMellat: boolean;
  enableZarinpal: boolean;
  enableCardTransfer: boolean;
  enableBankTransfer: boolean;
  enableStripe: boolean;
  enableTap: boolean;
  enablePaypal: boolean;
  mellatTerminalId: string | null;
  mellatUsername: string | null;
  mellatPasswordSet: boolean;
  zarinpalMerchantId: string | null;
  stripePublicKey: string | null;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
  tapSecretKeySet: boolean;
  paypalClientId: string | null;
  paypalClientSecretSet: boolean;
  cardNumber: string | null;
  iban: string | null;
  accountHolder: string | null;
  bankName: string | null;
  manualNotes: string | null;
};

type Props = { initial: PublicSettings };

type FormState = {
  enableMellat: boolean;
  enableZarinpal: boolean;
  enableCardTransfer: boolean;
  enableBankTransfer: boolean;
  enableStripe: boolean;
  enableTap: boolean;
  enablePaypal: boolean;
  mellatTerminalId: string;
  mellatUsername: string;
  mellatPassword: string; // empty = unchanged
  zarinpalMerchantId: string;
  stripePublicKey: string;
  stripeSecretKey: string; // empty = unchanged
  stripeWebhookSecret: string; // empty = unchanged
  tapSecretKey: string; // empty = unchanged
  paypalClientId: string;
  paypalClientSecret: string; // empty = unchanged
  cardNumber: string;
  iban: string;
  accountHolder: string;
  bankName: string;
  manualNotes: string;
};

/**
 * Admin form to manage gateway toggles, credentials and manual-transfer
 * bank info. Secret fields are write-only: server returns `<field>Set`
 * boolean flags, the form shows "configured" placeholder, and posting
 * an empty string keeps the existing value.
 */
export function PaymentSettingsForm({ initial }: Props) {
  const t = useTranslations('admin.paymentSettings');
  const [state, setState] = useState<FormState>({
    enableMellat: initial.enableMellat,
    enableZarinpal: initial.enableZarinpal,
    enableCardTransfer: initial.enableCardTransfer,
    enableBankTransfer: initial.enableBankTransfer,
    enableStripe: initial.enableStripe,
    enableTap: initial.enableTap,
    enablePaypal: initial.enablePaypal,
    mellatTerminalId: initial.mellatTerminalId ?? '',
    mellatUsername: initial.mellatUsername ?? '',
    mellatPassword: '',
    zarinpalMerchantId: initial.zarinpalMerchantId ?? '',
    stripePublicKey: initial.stripePublicKey ?? '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    tapSecretKey: '',
    paypalClientId: initial.paypalClientId ?? '',
    paypalClientSecret: '',
    cardNumber: initial.cardNumber ?? '',
    iban: initial.iban ?? '',
    accountHolder: initial.accountHolder ?? '',
    bankName: initial.bankName ?? '',
    manualNotes: initial.manualNotes ?? ''
  });
  const [secretsSet, setSecretsSet] = useState({
    mellatPasswordSet: initial.mellatPasswordSet,
    stripeSecretKeySet: initial.stripeSecretKeySet,
    stripeWebhookSecretSet: initial.stripeWebhookSecretSet,
    tapSecretKeySet: initial.tapSecretKeySet,
    paypalClientSecretSet: initial.paypalClientSecretSet
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setIssues([]);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/settings/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: PublicSettings;
        error?: string;
        issues?: string[];
      };
      if (!res.ok) {
        if (json.issues) setIssues(json.issues);
        throw new Error(json.error ?? `status ${res.status}`);
      }
      if (json.data) {
        setSecretsSet({
          mellatPasswordSet: json.data.mellatPasswordSet,
          stripeSecretKeySet: json.data.stripeSecretKeySet,
          stripeWebhookSecretSet: json.data.stripeWebhookSecretSet,
          tapSecretKeySet: json.data.tapSecretKeySet,
          paypalClientSecretSet: json.data.paypalClientSecretSet
        });
        setState((s) => ({
          ...s,
          mellatPassword: '',
          stripeSecretKey: '',
          stripeWebhookSecret: '',
          tapSecretKey: '',
          paypalClientSecret: ''
        }));
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save_failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title={t('iranTitle')} desc={t('iranDesc')}>
        <Toggle
          label={t('enableMellat')}
          checked={state.enableMellat}
          onChange={(v) => set('enableMellat', v)}
        />
        {state.enableMellat && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('mellatTerminalId')} value={state.mellatTerminalId} onChange={(v) => set('mellatTerminalId', v)} />
            <Field label={t('mellatUsername')} value={state.mellatUsername} onChange={(v) => set('mellatUsername', v)} />
            <SecretField
              label={t('mellatPassword')}
              isSet={secretsSet.mellatPasswordSet}
              value={state.mellatPassword}
              onChange={(v) => set('mellatPassword', v)}
              t={t}
            />
          </div>
        )}

        <Toggle
          label={t('enableZarinpal')}
          checked={state.enableZarinpal}
          onChange={(v) => set('enableZarinpal', v)}
        />
        {state.enableZarinpal && (
          <Field label={t('zarinpalMerchantId')} value={state.zarinpalMerchantId} onChange={(v) => set('zarinpalMerchantId', v)} />
        )}
      </Section>

      <Section title={t('intlTitle')} desc={t('intlDesc')}>
        <Toggle
          label={t('enableStripe')}
          checked={state.enableStripe}
          onChange={(v) => set('enableStripe', v)}
        />
        {state.enableStripe && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('stripePublicKey')} value={state.stripePublicKey} onChange={(v) => set('stripePublicKey', v)} />
            <SecretField
              label={t('stripeSecretKey')}
              isSet={secretsSet.stripeSecretKeySet}
              value={state.stripeSecretKey}
              onChange={(v) => set('stripeSecretKey', v)}
              t={t}
            />
            <SecretField
              label={t('stripeWebhookSecret')}
              isSet={secretsSet.stripeWebhookSecretSet}
              value={state.stripeWebhookSecret}
              onChange={(v) => set('stripeWebhookSecret', v)}
              t={t}
            />
          </div>
        )}

        <Toggle
          label={t('enableTap')}
          checked={state.enableTap}
          onChange={(v) => set('enableTap', v)}
        />
        {state.enableTap && (
          <SecretField
            label={t('tapSecretKey')}
            isSet={secretsSet.tapSecretKeySet}
            value={state.tapSecretKey}
            onChange={(v) => set('tapSecretKey', v)}
            t={t}
          />
        )}

        <Toggle
          label={t('enablePaypal')}
          checked={state.enablePaypal}
          onChange={(v) => set('enablePaypal', v)}
        />
        {state.enablePaypal && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('paypalClientId')} value={state.paypalClientId} onChange={(v) => set('paypalClientId', v)} />
            <SecretField
              label={t('paypalClientSecret')}
              isSet={secretsSet.paypalClientSecretSet}
              value={state.paypalClientSecret}
              onChange={(v) => set('paypalClientSecret', v)}
              t={t}
            />
          </div>
        )}
      </Section>

      <Section title={t('manualTitle')} desc={t('manualDesc')}>
        <Toggle
          label={t('enableCardTransfer')}
          checked={state.enableCardTransfer}
          onChange={(v) => set('enableCardTransfer', v)}
        />
        <Toggle
          label={t('enableBankTransfer')}
          checked={state.enableBankTransfer}
          onChange={(v) => set('enableBankTransfer', v)}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('bankName')} value={state.bankName} onChange={(v) => set('bankName', v)} />
          <Field label={t('accountHolder')} value={state.accountHolder} onChange={(v) => set('accountHolder', v)} />
          <Field label={t('cardNumber')} value={state.cardNumber} onChange={(v) => set('cardNumber', v)} />
          <Field label={t('iban')} value={state.iban} onChange={(v) => set('iban', v)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('manualNotes')}
          </label>
          <textarea
            value={state.manualNotes}
            onChange={(e) => set('manualNotes', e.target.value)}
            rows={2}
            maxLength={512}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
      </Section>

      {issues.length > 0 && (
        <ul className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-1">
          {issues.map((i) => (
            <li key={i}>• {t.has(`issue.${i}`) ? t(`issue.${i}` as never) : i}</li>
          ))}
        </ul>
      )}
      {error && !issues.length && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm font-medium text-emerald-600">{t('saved')}</p>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  desc,
  children
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <span className="relative inline-flex h-5 w-9 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
        <span className="absolute start-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        autoComplete="off"
      />
    </div>
  );
}

function SecretField({
  label,
  isSet,
  value,
  onChange,
  t
}: {
  label: string;
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        {isSet && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            {t('configured')}
          </span>
        )}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? t('leaveBlankToKeep') : t('enterValue')}
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        autoComplete="new-password"
      />
    </div>
  );
}
