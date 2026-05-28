import { NextResponse } from 'next/server';
import { expireOverdueRfqs, autoCloseFulfilledRfqs } from '@/lib/rfq/jobs/expire-rfqs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Called by Vercel Cron (or any external scheduler) on a schedule. */
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [expiry, autoClose] = await Promise.all([
    expireOverdueRfqs(),
    autoCloseFulfilledRfqs(),
  ]);

  return NextResponse.json({ ok: true, expiry, autoClose });
}
