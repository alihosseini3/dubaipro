'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type DeleteButtonProps = {
  endpoint: string;
  label?: string;
  confirmLabel?: string;
  redirectTo?: string;
  compact?: boolean;
  onDeleted?: () => void;
};

export function DeleteButton({
  endpoint,
  label,
  confirmLabel,
  redirectTo,
  compact,
  onDeleted,
}: DeleteButtonProps) {
  const t = useTranslations('admin.common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirm = confirmLabel ?? t('deleteConfirm');
    if (!window.confirm(confirm)) return;

    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      startTransition(() => {
        if (onDeleted) onDeleted();
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteFailed'));
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          compact
            ? 'rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50'
            : 'inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50'
        }
      >
        {pending ? t('working') : (label ?? t('delete'))}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
