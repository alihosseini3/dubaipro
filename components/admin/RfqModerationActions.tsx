'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RfqRequestStatus } from '@prisma/client';

type Props = {
  slug: string;
  status: RfqRequestStatus;
  locale: string;
};

/**
 * Admin moderation controls for the RFQ requests queue.
 *
 * - Always shows a "View" link to the public detail page (admins can
 *   read any RFQ).
 * - For PENDING_REVIEW rows, adds Approve / Reject buttons wired to the
 *   admin-only moderation endpoint.
 */
export function RfqModerationActions({ slug, status, locale }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(action: 'approve' | 'reject') {
    if (busy) return;
    setError(null);

    if (action === 'reject') {
      const ok = window.confirm('Reject and cancel this RFQ? This cannot be undone.');
      if (!ok) return;
    }

    setBusy(action);
    try {
      const res = await fetch(`/api/rfq/requests/${slug}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Action failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/${locale}/rfq/${slug}`}
        target="_blank"
        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-600 dark:border-slate-600"
      >
        View
      </Link>

      {status === 'PENDING_REVIEW' && (
        <>
          <button
            type="button"
            onClick={() => moderate('approve')}
            disabled={busy !== null}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/20"
          >
            {busy === 'approve' ? '…' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => moderate('reject')}
            disabled={busy !== null}
            className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/20"
          >
            {busy === 'reject' ? '…' : 'Reject'}
          </button>
        </>
      )}

      {error && <span className="text-[10px] font-medium text-red-500">{error}</span>}
    </div>
  );
}
