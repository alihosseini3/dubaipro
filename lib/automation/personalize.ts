import 'server-only';

import { prisma } from '@/lib/prisma';
import { getRelatedProducts } from '@/lib/recommendations/service';

import type { TemplateVars } from './interpolate';

/**
 * Build the dynamic per-user variables that segment-specific templates
 * use ({lastProduct}, {recommendedProducts}, {discountCode}).
 *
 * All lookups are best-effort — a missing product just yields an empty
 * string in the rendered email, which is preferable to a literal
 * "{lastProduct}" leaking through. The caller still passes any
 * transactional vars ({name}, {price}, {link}) on top of these.
 */
export async function buildPersonalVars(
  userId: string,
  opts: { discountCode?: string; recommendedLimit?: number } = {}
): Promise<TemplateVars> {
  const limit = opts.recommendedLimit ?? 3;

  // Latest paid order's first item is the best "last product" anchor.
  // We also use it to seed recommendations.
  let lastProductTitle = '';
  let lastProductId: string | null = null;
  try {
    const order = await prisma.order.findFirst({
      where: { userId, paymentStatus: 'PAID' },
      orderBy: { paidAt: 'desc' },
      select: {
        items: {
          take: 1,
          orderBy: { id: 'asc' },
          select: {
            productId: true,
            product: { select: { title: true } }
          }
        }
      }
    });
    const item = order?.items[0];
    if (item) {
      lastProductId = item.productId;
      lastProductTitle = item.product?.title ?? '';
    }
  } catch {
    /* fall through with empty values */
  }

  let recommendedProducts = '';
  if (lastProductId) {
    try {
      const recs = await getRelatedProducts(lastProductId, limit);
      // Plain text join — works in both HTML emails and WhatsApp.
      // HTML templates can wrap the resulting string in their own
      // markup if richer formatting is needed.
      recommendedProducts = recs.map((r) => r.title).join(', ');
    } catch {
      /* leave empty */
    }
  }

  return {
    lastProduct: lastProductTitle,
    recommendedProducts,
    discountCode: opts.discountCode ?? ''
  };
}
