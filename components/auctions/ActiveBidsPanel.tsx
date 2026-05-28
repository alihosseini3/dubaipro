'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Bid = {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
};

type Props = {
  auctionId: string;
  locale: string;
  loggedIn: boolean;
  loginHref: string;
};

function fmt(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function ActiveBidsPanel({ auctionId, locale, loggedIn, loginHref }: Props) {
  const t = useTranslations('auctions.detail');
  const [bids, setBids] = useState<Bid[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingBidId, setPendingBidId] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetch(`/api/auctions/${auctionId}/bids`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? 'load_failed');
        }
        return res.json();
      })
      .then((json: { data?: Bid[] }) => setBids(json.data ?? []))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setBids([]);
        setError(messageFor(t, err instanceof Error ? err.message : 'load_failed'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [auctionId, loggedIn]);

  if (!loggedIn) {
    return (
      <div className="rounded-3xl border border-orange-100 bg-orange-50/70 p-5 text-center">
        <p className="text-sm font-black text-[#0F172A]">{t('activeBidsLoginTitle')}</p>
        <p className="mt-1 text-xs text-slate-600">{t('activeBidsLoginDesc')}</p>
        <a href={loginHref} className="mt-4 inline-flex rounded-2xl bg-[#F97316] px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5">
          {t('activeBidsLoginButton')}
        </a>
      </div>
    );
  }

  async function updateBid(bidId: string) {
    setError(null);
    const next = Number(amount);
    if (!Number.isFinite(next) || next <= 0) {
      setError(t('activeBidsErrInvalidAmount'));
      return;
    }
    setPendingBidId(bidId);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, amount: next }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'update_failed');
      }

      setBids((prev) => prev.map((bid) => (bid.id === bidId ? { ...bid, amount: next } : bid)));
      setEditing(null);
      setAmount('');
    } catch (err) {
      setError(messageFor(t, err instanceof Error ? err.message : 'update_failed'));
    } finally {
      setPendingBidId(null);
    }
  }

  async function cancelBid(bidId: string) {
    setError(null);
    setPendingBidId(bidId);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'cancel_failed');
      }

      setBids((prev) => prev.filter((bid) => bid.id !== bidId));
      setEditing((current) => (current === bidId ? null : current));
      if (editing === bidId) setAmount('');
    } catch (err) {
      setError(messageFor(t, err instanceof Error ? err.message : 'cancel_failed'));
    } finally {
      setPendingBidId(null);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{t('activeBidsTitle')}</p>
          <p className="mt-1 text-sm font-bold text-slate-600">{t('activeBidsSubtitle')}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{bids.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : null}

      {!loading && bids.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-black text-[#0F172A]">{t('activeBidsEmpty')}</p>
          <p className="mt-1 text-xs text-slate-500">{t('activeBidsEmptyDesc')}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        {bids.map((bid) => (
          <div key={bid.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#0F172A]">{fmt(bid.amount, bid.currency, locale)}</p>
                <p className="text-[11px] text-slate-500">{new Date(bid.createdAt).toLocaleString(locale)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setError(null); setEditing(bid.id); setAmount(String(bid.amount)); }} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:text-[#F97316]">
                  {t('activeBidsEdit')}
                </button>
                <button type="button" disabled={pendingBidId === bid.id} onClick={() => void cancelBid(bid.id)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-600 ring-1 ring-rose-100 transition hover:bg-rose-50 disabled:opacity-60">
                  {pendingBidId === bid.id ? t('activeBidsCancelling') : t('activeBidsCancel')}
                </button>
              </div>
            </div>
            {editing === bid.id && (
              <div className="mt-3 flex gap-2">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="any" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#F97316]" />
                <button type="button" disabled={pendingBidId === bid.id} onClick={() => void updateBid(bid.id)} className="rounded-xl bg-[#F97316] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                  {pendingBidId === bid.id ? t('activeBidsSaving') : t('activeBidsSave')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && bids.length === 0 && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {t('activeBidsEmpty')}
        </p>
      )}

      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
    </div>
  );
}

function messageFor(t: (k: string) => string, reason: string): string {
  switch (reason) {
    case 'too_low': return t('activeBidsErrTooLow');
    case 'ended': return t('activeBidsErrEnded');
    case 'not_live': return t('activeBidsErrNotLive');
    case 'not_found': return t('activeBidsErrNotFound');
    case 'unauthorized': return t('activeBidsErrUnauthorized');
    case 'load_failed': return t('activeBidsErrLoadFailed');
    case 'update_failed': return t('activeBidsErrUpdateFailed');
    case 'cancel_failed': return t('activeBidsErrCancelFailed');
    default: return t('activeBidsErrGeneric');
  }
}
