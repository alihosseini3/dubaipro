import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_SOURCES = new Set([
  'floating',
  'product',
  'supplier',
  'unknown'
]);

function sanitizeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  // cuid/uuid-safe charset; cap length defensively.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) return null;
  return v;
}

/** Conservative UTM value validator — prevents PII smuggling through URLs. */
function sanitizeUtm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().slice(0, 64);
  if (!v) return null;
  if (!/^[a-z0-9_.\-\s]+$/i.test(v)) return null;
  return v;
}

/**
 * Public fire-and-forget click tracking. Never throws to the client;
 * always returns 204 so a failed insert cannot affect the UI.
 */
/** Validate a client-supplied attribution id (UUID v4 / v7-like). */
function sanitizeClickId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
    return null;
  return v.toLowerCase();
}

export async function POST(request: Request) {
  let clickId: string | null = null;
  let productId: string | null = null;
  let supplierId: string | null = null;
  let source = 'unknown';
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      clickId?: unknown;
      productId?: unknown;
      supplierId?: unknown;
      source?: unknown;
      utmSource?: unknown;
      utmMedium?: unknown;
      utmCampaign?: unknown;
    };
    clickId = sanitizeClickId(body.clickId);
    productId = sanitizeId(body.productId);
    supplierId = sanitizeId(body.supplierId);
    if (typeof body.source === 'string') {
      const s = body.source.trim().toLowerCase();
      if (ALLOWED_SOURCES.has(s)) source = s;
    }
    utmSource = sanitizeUtm(body.utmSource);
    utmMedium = sanitizeUtm(body.utmMedium);
    utmCampaign = sanitizeUtm(body.utmCampaign);
  } catch {
    // Swallow — still record an anonymous click.
  }

  try {
    // Dedup by primary key: when the same clickId is reported twice (e.g.
    // sendBeacon retry, middle-click + main-click), `createMany` with
    // `skipDuplicates` makes the insert a no-op with no extra roundtrip.
    // `expiresAt` marks the end of the 24h attribution window.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.whatsAppClick.createMany({
      data: [
        {
          ...(clickId ? { id: clickId } : {}),
          productId,
          supplierId,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
          expiresAt
        }
      ],
      skipDuplicates: true
    });
  } catch {
    // Do not fail the client on DB errors.
  }

  return new NextResponse(null, { status: 204 });
}
