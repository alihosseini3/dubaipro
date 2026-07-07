'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = {
  sellerUserId: string;
  locale: string;
  isAuthenticated: boolean;
  returnPath: string;
};

export function ChatWithSellerButton({
  sellerUserId,
  locale,
  isAuthenticated,
  returnPath
}: Props) {
  const t = useTranslations('chat');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);

    if (!isAuthenticated) {
      router.push(
        `/${locale}/login?redirect=${encodeURIComponent(returnPath)}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: sellerUserId })
      });

      if (res.status === 401) {
        router.push(
          `/${locale}/login?from=${encodeURIComponent(returnPath)}`
        );
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.data?.id) {
        setError(t('errorSend'));
        return;
      }
      router.push(`/${locale}/account/messages/${json.data.id}`);
    } catch {
      setError(t('errorSend'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{loading ? t('sending') : t('startChat')}</span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
