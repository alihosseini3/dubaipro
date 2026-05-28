import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  getPaymentSettingsPublic,
  updatePaymentSettings,
  toPublic,
  type PaymentSettingsUpdate
} from '@/lib/payments/settings';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/admin/settings/payments
 *
 * Returns the singleton in its **public** shape: secret fields are
 * replaced with `<field>Set: boolean` flags so the UI can show
 * "configured" without ever holding the real value.
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const data = await getPaymentSettingsPublic();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/admin/settings/payments failed:', err);
    return serverError();
  }
}

const ALLOWED_KEYS: Array<keyof PaymentSettingsUpdate> = [
  'enableMellat',
  'enableZarinpal',
  'enableCardTransfer',
  'enableBankTransfer',
  'enableStripe',
  'enableTap',
  'enablePaypal',
  'mellatTerminalId',
  'mellatUsername',
  'mellatPassword',
  'zarinpalMerchantId',
  'stripePublicKey',
  'stripeSecretKey',
  'stripeWebhookSecret',
  'tapSecretKey',
  'paypalClientId',
  'paypalClientSecret',
  'cardNumber',
  'iban',
  'accountHolder',
  'bankName',
  'manualNotes'
];

/**
 * PUT /api/admin/settings/payments
 *
 * Accepts a partial patch. Empty strings on secret fields mean
 * "no change". Booleans are coerced. Validation runs before persist
 * — enabling a gateway without its required credentials returns 422.
 */
export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: PaymentSettingsUpdate = {};
  for (const key of ALLOWED_KEYS) {
    if (!(key in body)) continue;
    const value = body[key];
    if (key.startsWith('enable')) {
      (patch as Record<string, unknown>)[key] = Boolean(value);
    } else if (value === null || value === '') {
      (patch as Record<string, unknown>)[key] =
        value === null ? null : '';
    } else if (typeof value === 'string') {
      (patch as Record<string, unknown>)[key] = value.trim();
    }
  }

  try {
    const result = await updatePaymentSettings(patch);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'validation_failed', issues: result.issues },
        { status: 422 }
      );
    }
    return NextResponse.json({ data: toPublic(result.settings) });
  } catch (err) {
    console.error('PUT /api/admin/settings/payments failed:', err);
    return serverError();
  }
}
