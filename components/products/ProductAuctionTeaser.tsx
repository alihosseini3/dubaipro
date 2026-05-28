import { getTranslations } from 'next-intl/server';

import { RelatedAuctions } from '@/components/auctions/RelatedAuctions';
import { listRelatedAuctions } from '@/lib/auctions/service';
import { localizeArray }       from '@/lib/i18n/localize';

type Props = {
  categoryId: string | null;
  supplierId: string | null;
  locale:     string;
};

/**
 * Server component shown on the product detail page that surfaces any
 * live or upcoming auctions tied to the same category or supplier.
 * Renders nothing if there are no matches, so the slot stays clean
 * for products that aren't auction-adjacent.
 */
export async function ProductAuctionTeaser({ categoryId, supplierId, locale }: Props) {
  if (!categoryId && !supplierId) return null;

  const raw = await listRelatedAuctions({ categoryId, supplierId, limit: 4 });
  if (raw.length === 0) return null;

  const auctions = await localizeArray(raw, locale, ['title', 'supplierName']);
  const t = await getTranslations({ locale, namespace: 'auctions.detail' });

  return <RelatedAuctions auctions={auctions} locale={locale} title={t('related')} />;
}
