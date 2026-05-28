import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { listRates, setRate } from '@/lib/currency/rates';
import type {
  Currency,
  CurrencyRateDTO,
  CurrencyRatesUpdateInput
} from '@/types/currency';
import { SUPPORTED_CURRENCIES } from '@/types/currency';

/** GET — admin only. Returns every supported currency + current rate. */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await listRates();
  const data: CurrencyRateDTO[] = rows.map((r) => ({
    code: r.code,
    rate: r.rate,
    updatedAt: r.updatedAt,
    isDefault: r.isDefault
  }));
  return NextResponse.json({ data });
}

/**
 * PATCH — admin only. Accepts a partial map of currency → rate and upserts
 * each entry individually so a single bad value can't corrupt the others.
 */
export async function PATCH(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: CurrencyRatesUpdateInput;
  try {
    body = (await request.json()) as CurrencyRatesUpdateInput;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body?.rates || typeof body.rates !== 'object') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const details: Record<string, string> = {};
  for (const [rawCode, rawRate] of Object.entries(body.rates)) {
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(rawCode)) {
      details[rawCode] = 'unsupported_currency';
      continue;
    }
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      details[rawCode] = 'invalid_rate';
      continue;
    }
    try {
      await setRate(rawCode as Currency, rate, 'manual', admin.id);
    } catch (err) {
      details[rawCode] =
        err instanceof Error ? err.message.split(':')[0] : 'unknown';
    }
  }

  if (Object.keys(details).length > 0) {
    return NextResponse.json(
      { error: 'partial_failure', details },
      { status: 400 }
    );
  }

  const rows = await listRates();
  const data: CurrencyRateDTO[] = rows.map((r) => ({
    code: r.code,
    rate: r.rate,
    updatedAt: r.updatedAt,
    isDefault: r.isDefault
  }));
  return NextResponse.json({ data });
}
