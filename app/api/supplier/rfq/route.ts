import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getRecommendedRfqsForSupplier } from '@/lib/rfq/matching';

export const runtime = 'nodejs';

/**
 * GET /api/supplier/rfq
 *
 * Returns the supplier's RFQ inbox:
 *   - invited: RFQs the supplier was explicitly invited to
 *   - active: RFQs where the supplier has a SUBMITTED/ACCEPTED quote
 *   - recommended: open RFQs matching the supplier's category/product mix
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'SUPPLIER' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 });

    const supplierId = supplier.id;
    const url = new URL(request.url);
    const tab = url.searchParams.get('tab') ?? 'invited';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const CARD_SELECT = {
      id: true, slug: true, title: true, quantity: true, unit: true,
      targetPrice: true, currency: true, shippingCountry: true,
      urgency: true, status: true, quoteCount: true, expiresAt: true, createdAt: true,
      user: { select: { name: true } },
      category: { select: { name: true } },
    } as const;

    if (tab === 'active') {
      // RFQs where this supplier has a quote
      const quotes = await prisma.rfqQuote.findMany({
        where: { supplierId, status: { notIn: ['WITHDRAWN'] } },
        select: {
          id: true, status: true, price: true, currency: true, createdAt: true,
          rfq: { select: CARD_SELECT },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      });
      return NextResponse.json({ data: quotes });
    }

    if (tab === 'recommended') {
      const rfqIds = await getRecommendedRfqsForSupplier(supplierId, 30);
      const rfqs = await prisma.rfqRequest.findMany({
        where: { id: { in: rfqIds } },
        select: CARD_SELECT,
      });
      return NextResponse.json({ data: rfqs });
    }

    // Default: invited
    const invites = await prisma.rfqSupplierInvite.findMany({
      where: { supplierId },
      select: {
        id: true, invitedAt: true, viewedAt: true,
        rfq: { select: CARD_SELECT },
      },
      orderBy: { invitedAt: 'desc' },
      skip,
      take: limit,
    });

    // Stamp viewedAt on first open
    const unviewed = invites.filter((i) => !i.viewedAt).map((i) => i.id);
    if (unviewed.length > 0) {
      prisma.rfqSupplierInvite
        .updateMany({ where: { id: { in: unviewed } }, data: { viewedAt: new Date() } })
        .catch(() => null);
    }

    return NextResponse.json({ data: invites });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/rfq');
  }
}
