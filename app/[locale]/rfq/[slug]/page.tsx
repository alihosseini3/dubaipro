import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { getRfqBySlug } from '@/lib/rfq/service';
import { RfqDetailClient } from './_components/RfqDetailClient';
import type { ClientRfqDetail } from './_components/RfqDetailClient';

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function RfqDetailPage({ params }: Props) {
  const { locale, slug } = await params;

  const user = await getCurrentUser();
  const rfq = await getRfqBySlug(slug, user?.id, user?.role === 'ADMIN');

  if (!rfq) notFound();

  const isBuyer = user?.id === rfq.userId;

  // Serialize Date objects to ISO strings for the Client Component boundary
  const clientRfq: ClientRfqDetail = {
    ...rfq,
    createdAt: rfq.createdAt.toISOString(),
    expiresAt: rfq.expiresAt?.toISOString() ?? null,
    quotes: rfq.quotes.map((q) => ({
      ...q,
      validUntil: q.validUntil?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
  };

  return (
    <RfqDetailClient
      rfq={clientRfq}
      isBuyer={isBuyer}
      currentUserId={user?.id ?? null}
      locale={locale}
    />
  );
}
