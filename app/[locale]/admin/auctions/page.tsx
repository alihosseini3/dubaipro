import Link from 'next/link';

import { AuctionsManager } from '@/components/admin/auctions/AuctionsManager';
import { getGalleriesByAuctionIds, listAllAuctions } from '@/lib/auctions/service';

type Props = { params: Promise<{ locale: string }> };

// Always read fresh data — admins expect their changes to be reflected
// on every navigation.
export const dynamic = 'force-dynamic';

/**
 * /admin/auctions — single screen for managing every auction lot.
 *
 * Auth is enforced by `app/[locale]/admin/layout.tsx` (`requireAdmin`),
 * so we don't repeat the check here.
 */
export default async function AdminAuctionsPage({ params }: Props) {
  const { locale } = await params;
  const auctions = await listAllAuctions();
  const galleries = await getGalleriesByAuctionIds(auctions.map((a) => a.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            <Link
              href={`/${locale}/admin/dashboard`}
              className="hover:text-slate-700"
            >
              Dashboard
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            <span>Auctions</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Auctions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage auction lots. Live lots appear on{' '}
            <Link
              href={`/${locale}/auctions`}
              className="font-semibold text-orange-600 hover:underline"
            >
              the public auctions page
            </Link>{' '}
            and the homepage <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">AUCTION</code> section.
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 sm:p-6">
        <AuctionsManager initial={auctions} galleries={galleries} />
      </section>

      <p className="text-xs text-slate-500">
        Tip: lots are auto-flipped between SCHEDULED → LIVE → ENDED based on
        the start/end timestamps. Bids are only accepted while LIVE.
      </p>
    </div>
  );
}
