import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Audience segments for retargeting / lookalike seeding.
 *
 * Definitions:
 *   - `viewedNotBought`: visitors who viewed a product (proxy = had a
 *     non-empty wishlist OR cart item) in the last 30 days but never
 *     completed an order. We use wishlist+cart instead of raw page-view
 *     logs because we don't store anonymous browsing history.
 *   - `cartAbandoned`: users with at least one CartItem and no PAID
 *     order — the textbook abandoned-cart segment.
 *   - `previousBuyers`: users with at least one PAID order. The most
 *     valuable lookalike seed for ad networks.
 *
 * Rather than ship raw emails over the wire, the GET returns counts
 * only. The CSV endpoint streams hashed-email exports — those are the
 * format Google Customer Match and Meta Custom Audiences accept.
 */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const segment = searchParams.get('segment') as Segment | null;

  try {
    if (format === 'csv' && segment) {
      const emails = await listEmails(segment);
      // crypto.subtle.digest is async; collect all hashes before joining.
      const hashes = await Promise.all(emails.map(sha256Hex));
      const csv = ['email_sha256', ...hashes].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audience-${segment}.csv"`
        }
      });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [cartAbandoned, previousBuyers, viewedNotBought] = await Promise.all([
      prisma.user.count({
        where: {
          cart: { items: { some: {} } },
          orders: { none: { paymentStatus: 'PAID' } }
        }
      }),
      prisma.user.count({
        where: { orders: { some: { paymentStatus: 'PAID' } } }
      }),
      // "Viewed" proxy: wishlist OR cart entry in the last 30 days,
      // AND no successful order ever. Both signals are user-explicit
      // so they're closer to "interested" than raw impressions.
      prisma.user.count({
        where: {
          AND: [
            {
              OR: [
                { wishlist: { items: { some: { createdAt: { gte: since } } } } },
                { cart: { items: { some: { createdAt: { gte: since } } } } }
              ]
            },
            { orders: { none: { paymentStatus: 'PAID' } } }
          ]
        }
      })
    ]);

    return NextResponse.json({
      data: { viewedNotBought, cartAbandoned, previousBuyers }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/marketing/audiences');
  }
}

type Segment = 'viewedNotBought' | 'cartAbandoned' | 'previousBuyers';

async function listEmails(segment: Segment): Promise<string[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // We cap each export so a misuse can't dump the entire user table.
  const TAKE = 50_000;

  if (segment === 'previousBuyers') {
    const rows = await prisma.user.findMany({
      where: { orders: { some: { paymentStatus: 'PAID' } } },
      select: { email: true },
      take: TAKE
    });
    return rows.map((r) => r.email.toLowerCase().trim());
  }
  if (segment === 'cartAbandoned') {
    const rows = await prisma.user.findMany({
      where: {
        cart: { items: { some: {} } },
        orders: { none: { paymentStatus: 'PAID' } }
      },
      select: { email: true },
      take: TAKE
    });
    return rows.map((r) => r.email.toLowerCase().trim());
  }
  // viewedNotBought
  const rows = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { wishlist: { items: { some: { createdAt: { gte: since } } } } },
            { cart: { items: { some: { createdAt: { gte: since } } } } }
          ]
        },
        { orders: { none: { paymentStatus: 'PAID' } } }
      ]
    },
    select: { email: true },
    take: TAKE
  });
  return rows.map((r) => r.email.toLowerCase().trim());
}

/**
 * SHA-256 hex of a UTF-8 string. Both Google and Meta require lowercase
 * trimmed emails hashed before upload — never raw PII.
 */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
