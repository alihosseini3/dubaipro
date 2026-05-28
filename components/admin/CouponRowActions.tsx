'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  id: string;
  locale: string;
  isActive: boolean;
};

/**
 * Per-row admin actions for a coupon: toggle active, edit link, delete.
 */
export function CouponRowActions({ id, locale, isActive }: Props) {
  const t = useTranslations('admin.coupons');
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    const next = !active;
    setActive(next); // optimistic
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setActive(!next);
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDelete'))) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(payload.message ?? payload.error ?? `status ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={toggleActive}
        disabled={pending}
        className={
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ' +
          (active
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100')
        }
        aria-pressed={active}
      >
        <span
          className={
            'h-1.5 w-1.5 rounded-full ' +
            (active ? 'bg-emerald-500' : 'bg-slate-400')
          }
          aria-hidden
        />
        {active ? t('active') : t('inactive')}
      </button>

      <Link
        href={`/${locale}/admin/coupons/${id}/edit`}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {t('edit')}
      </Link>

      <button
        type="button"
        onClick={handleDelete}
        className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
      >
        {t('delete')}
      </button>

      {error && (
        <span className="text-[11px] font-medium text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
