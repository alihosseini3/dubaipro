import { NextResponse } from 'next/server';

import { relayOutboxEvents } from '@/lib/rfq/jobs/relay-outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Drains the RFQ event outbox. Called by the scheduler (Vercel Cron or
 * any external trigger) on a short interval. Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await relayOutboxEvents();
  return NextResponse.json({ ok: true, ...result });
}
