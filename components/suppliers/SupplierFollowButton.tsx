'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = {
  supplierSlug: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  isAuthenticated: boolean;
  loginHref: string;
};

/**
 * Client-side toggle. Optimistic update on click; reverts on server error.
 * Anonymous users are routed to login with a `?returnTo` query so they
 * land back on the supplier page after authentication.
 */
export function SupplierFollowButton({
  supplierSlug,
  initialFollowing,
  initialFollowerCount,
  isAuthenticated,
  loginHref
}: Props) {
  const t = useTranslations('suppliers');
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
  const [pending, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <a
        href={loginHref}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        {t('loginToFollow')}
      </a>
    );
  }

  async function toggle() {
    const next = !following;
    // Optimistic
    setFollowing(next);
    setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));

    try {
      const res = await fetch(`/api/suppliers/${supplierSlug}/follow`, {
        method: next ? 'POST' : 'DELETE'
      });
      if (!res.ok) throw new Error('failed');
      const json = (await res.json()) as {
        data: { following: boolean; followerCount: number };
      };
      setFollowing(json.data.following);
      setCount(json.data.followerCount);
      startTransition(() => router.refresh());
    } catch {
      // revert
      setFollowing(!next);
      setCount((c) => (next ? Math.max(0, c - 1) : c + 1));
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        following
          ? 'inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50'
          : 'inline-flex items-center gap-2 rounded-full border border-slate-900 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:opacity-50'
      }
    >
      <span>{following ? t('following') : t('follow')}</span>
      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs">
        {count}
      </span>
    </button>
  );
}
