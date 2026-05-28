'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type UserDeleteButtonProps = {
  userId: string;
  userEmail: string;
  /** Acting admin's own id — when equal to userId, deletion is disabled. */
  actingAdminId: string;
  redirectTo: string;
};

/**
 * Hardened delete affordance for user rows. Refuses to act on the current
 * admin's own id (button becomes disabled with an explanation) and
 * surfaces server-side errors (e.g. 409 when the user has existing orders).
 */
export function UserDeleteButton({
  userId,
  userEmail,
  actingAdminId,
  redirectTo
}: UserDeleteButtonProps) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSelf = userId === actingAdminId;

  async function handleClick() {
    if (isSelf) return;
    if (!window.confirm(t('deleteConfirm', { email: userEmail }))) return;

    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      startTransition(() => router.push(redirectTo));
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('deleteFailed'));
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || isSelf}
        className="inline-flex w-full items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? tCommon('working') : t('deleteUser')}
      </button>
      {isSelf && (
        <p className="text-xs text-slate-500">{t('deleteSelfBlocked')}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
