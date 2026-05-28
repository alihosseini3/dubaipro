import { NextResponse } from 'next/server';

import { methodsForCountry, type PaymentMethodDef } from '@/lib/payments/methods';

export const runtime = 'nodejs';

/**
 * GET /api/payment/methods?country=AE
 *
 * Returns the methods enabled for the given country. Manual-flow methods
 * additionally include their account info (bank/IBAN) so the checkout UI
 * can render instructions without a second round-trip.
 *
 * Note: account info is read from server env on demand and stripped to
 * the public-facing fields only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') || '*';
  const methods = await methodsForCountry(country);

  // Strip server-only fields → keep `provider` so the client knows which
  // endpoint to hit, but never expose env credentials.
  const data = methods.map((m: PaymentMethodDef) => ({
    code: m.code,
    provider: m.provider,
    kind: m.kind,
    countries: m.countries,
    logo: m.logo ?? null,
    i18nKey: m.i18nKey
  }));

  return NextResponse.json({ data });
}
