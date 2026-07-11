import { NextResponse } from 'next/server';

import { runSubscriptionExpiry } from '@/lib/subscriptions/service';

/**
 * Daily subscription maintenance: warn 7 days before expiry, expire overdue
 * subscriptions and auto-downgrade to FREE.
 *
 * Run via external scheduler, e.g. vercel.json:
 *   { "crons": [{ "path": "/api/cron/subscriptions", "schedule": "0 3 * * *" }] }
 * Authenticate with `Authorization: Bearer <CRON_SECRET>`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runSubscriptionExpiry();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
