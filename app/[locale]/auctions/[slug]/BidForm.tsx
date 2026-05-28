'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Props = {
  auctionId: string;
  /** Minimum bid amount the form will accept (currentBid + minIncrement). */
  minNextBid: number;
  /** Currency the lot trades in (typically AED). */
  currency: string;
};

/**
 * Bid form for the public auction detail page. Posts to
 * `/api/auctions/[id]/bid`, then refreshes the route so the SSR
 * snapshot (current bid + recent bids list + bid count) re-renders
 * without a hard reload.
 */
export function BidForm({ auctionId, minNextBid, currency }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(minNextBid);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!Number.isFinite(amount) || amount < minNextBid) {
      setError(`Bid must be at least ${minNextBid} ${currency}.`);
      return;
    }
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'bid_failed');
      }
      setSuccess(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(messageFor((e as Error).message));
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">
          Your bid ({currency})
        </span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          min={minNextBid}
          step={1}
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-bold text-slate-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-300"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_10px_24px_rgba(249,115,22,0.5)] disabled:opacity-60"
      >
        {isPending ? 'Placing bid…' : 'Place bid'}
      </button>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Bid placed!
        </p>
      )}
    </form>
  );
}

function messageFor(reason: string): string {
  switch (reason) {
    case 'too_low':
      return 'Bid is below the minimum increment.';
    case 'ended':
      return 'This auction has ended.';
    case 'not_live':
      return 'Bidding is not open yet.';
    case 'not_found':
      return 'Auction not found.';
    case 'unauthorized':
      return 'Please sign in to bid.';
    default:
      return 'Bid failed — try again.';
  }
}
