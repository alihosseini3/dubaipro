'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type UserPasswordResetProps = {
  userId: string;
};

/**
 * Generates a temporary password for a user and shows it EXACTLY ONCE.
 *
 * UX notes:
 *   - The cleartext is rendered in a monospaced pill with a copy button.
 *   - After the first successful generation the button is replaced by a
 *     "generate again" action to make the destructive nature explicit
 *     (each click invalidates the previous temp password).
 *   - The value is cleared from client state as soon as the user hits
 *     "dismiss", reducing the window a bystander could read it from the
 *     screen.
 */
export function UserPasswordReset({ userId }: UserPasswordResetProps) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.common');

  const [pending, setPending] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    const prompt = tempPassword ? t('resetConfirmAgain') : t('resetConfirm');
    if (!window.confirm(prompt)) return;

    setError(null);
    setCopied(false);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST'
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { tempPassword?: string };
        error?: string;
      };
      if (!res.ok || !payload.data?.tempPassword) {
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      setTempPassword(payload.data.tempPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop — user can select & copy manually */
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleReset}
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending
          ? tCommon('working')
          : tempPassword
            ? t('resetAgain')
            : t('resetPassword')}
      </button>

      {tempPassword && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t('tempPasswordTitle')}
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            {t('tempPasswordHint')}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 select-all rounded bg-white px-2 py-1 font-mono text-sm text-slate-900 ring-1 ring-amber-200">
              {tempPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              {copied ? t('copied') : t('copy')}
            </button>
            <button
              type="button"
              onClick={() => setTempPassword(null)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
