import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getManualAccountInfo } from '@/lib/payments/methods';

export const runtime = 'nodejs';

/**
 * GET /api/payment/manual-info?code=CARD_TRANSFER|BANK_TRANSFER
 *
 * Returns the bank/card details to display to the customer for a manual
 * transfer. Auth-gated to avoid exposing account info to scrapers.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code !== 'CARD_TRANSFER' && code !== 'BANK_TRANSFER') {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }
  const info = await getManualAccountInfo(code);
  if (!info) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  return NextResponse.json({ data: info });
}
