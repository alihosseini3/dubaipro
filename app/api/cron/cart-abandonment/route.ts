import { NextResponse } from 'next/server';

import { runCartAbandonmentScan } from '@/lib/automation/cart-abandonment';

/**
 * Run via external scheduler (Vercel Cron, GitHub Actions, etc.) every
 * 5–10 minutes. Authenticate with `Authorization: Bearer <CRON_SECRET>`.
 *
 *   vercel.json:
 *   { "crons": [{ "path": "/api/cron/cart-abandonment", "schedule": "*\/10 * * * *" }] }
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
    const result = await runCartAbandonmentScan();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'unknown'
      },
      { status: 500 }
    );
  }
}
