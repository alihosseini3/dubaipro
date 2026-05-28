import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { getCurrentUser } from '@/lib/auth/session';
import { startCheckout } from '@/lib/payments/service';
import { PaymentError } from '@/lib/payments/types';
import { badRequest, serverError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = {
  orderId?: unknown;
  provider?: unknown;
  locale?: unknown;
};

async function resolveBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { orderId, provider, locale } = parsed.data;

  if (!isNonEmptyString(orderId)) return badRequest('orderId is required');
  const providerName = isNonEmptyString(provider) ? provider : 'stripe';
  const loc = isNonEmptyString(locale) ? locale : 'en';

  try {
    const baseUrl = await resolveBaseUrl();
    const result = await startCheckout({
      orderId,
      provider: providerName,
      userId: user.id,
      isAdmin: user.role === 'ADMIN',
      baseUrl,
      locale: loc
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('POST /api/payment/create-intent failed:', err);
    return serverError();
  }
}
