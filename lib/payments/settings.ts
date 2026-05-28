import 'server-only';

import { prisma } from '@/lib/prisma';

const SINGLETON_ID = 'default';

export type PaymentSettings = {
  id: string;
  enableMellat: boolean;
  enableZarinpal: boolean;
  enableCardTransfer: boolean;
  enableBankTransfer: boolean;
  enableStripe: boolean;
  enableTap: boolean;
  enablePaypal: boolean;
  mellatTerminalId: string | null;
  mellatUsername: string | null;
  mellatPassword: string | null;
  zarinpalMerchantId: string | null;
  stripePublicKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  tapSecretKey: string | null;
  paypalClientId: string | null;
  paypalClientSecret: string | null;
  cardNumber: string | null;
  iban: string | null;
  accountHolder: string | null;
  bankName: string | null;
  manualNotes: string | null;
  updatedAt: Date;
};

/**
 * Public DTO sent to admin client. Secrets are replaced with a fixed
 * mask so the UI can show "is configured" without ever transferring
 * the real value back to the browser.
 */
export type PaymentSettingsPublic = Omit<
  PaymentSettings,
  | 'mellatPassword'
  | 'stripeSecretKey'
  | 'stripeWebhookSecret'
  | 'tapSecretKey'
  | 'paypalClientSecret'
> & {
  mellatPasswordSet: boolean;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
  tapSecretKeySet: boolean;
  paypalClientSecretSet: boolean;
};

export type PaymentSettingsUpdate = Partial<
  Omit<PaymentSettings, 'id' | 'updatedAt'>
>;

let cache: { value: PaymentSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

/**
 * Read the singleton, creating it on first call. Result is cached for
 * 30s so per-request callers in `lib/payments/*` don't hammer the DB.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let row = await prisma.paymentSettings.findUnique({
    where: { id: SINGLETON_ID }
  });
  if (!row) {
    row = await prisma.paymentSettings.create({
      data: { id: SINGLETON_ID }
    });
  }
  cache = { value: row as PaymentSettings, expiresAt: now + CACHE_TTL_MS };
  return cache.value;
}

export function invalidatePaymentSettingsCache(): void {
  cache = null;
}

export async function getPaymentSettingsPublic(): Promise<PaymentSettingsPublic> {
  const s = await getPaymentSettings();
  return toPublic(s);
}

export function toPublic(s: PaymentSettings): PaymentSettingsPublic {
  const {
    mellatPassword,
    stripeSecretKey,
    stripeWebhookSecret,
    tapSecretKey,
    paypalClientSecret,
    ...rest
  } = s;
  return {
    ...rest,
    mellatPasswordSet: Boolean(mellatPassword),
    stripeSecretKeySet: Boolean(stripeSecretKey),
    stripeWebhookSecretSet: Boolean(stripeWebhookSecret),
    tapSecretKeySet: Boolean(tapSecretKey),
    paypalClientSecretSet: Boolean(paypalClientSecret)
  };
}

/**
 * Validate per-gateway requirements: enabling a gateway requires its
 * mandatory credentials. Returns a list of human-readable issues; an
 * empty array means "OK to save".
 */
export function validatePaymentSettings(
  next: PaymentSettings
): string[] {
  const issues: string[] = [];

  if (next.enableMellat) {
    if (!next.mellatTerminalId) issues.push('mellat_terminalId_required');
    if (!next.mellatUsername) issues.push('mellat_username_required');
    if (!next.mellatPassword) issues.push('mellat_password_required');
  }
  if (next.enableZarinpal && !next.zarinpalMerchantId) {
    issues.push('zarinpal_merchantId_required');
  }
  if (next.enableStripe) {
    if (!next.stripePublicKey) issues.push('stripe_publicKey_required');
    if (!next.stripeSecretKey) issues.push('stripe_secretKey_required');
  }
  if (next.enableTap && !next.tapSecretKey) {
    issues.push('tap_secretKey_required');
  }
  if (next.enablePaypal) {
    if (!next.paypalClientId) issues.push('paypal_clientId_required');
    if (!next.paypalClientSecret) issues.push('paypal_clientSecret_required');
  }
  if (next.enableCardTransfer && !next.cardNumber) {
    issues.push('cardTransfer_cardNumber_required');
  }
  if (next.enableBankTransfer && !next.iban) {
    issues.push('bankTransfer_iban_required');
  }

  return issues;
}

/**
 * Update the singleton with a partial patch. Empty strings on secret
 * fields are treated as "no change" (the admin form sends "" instead
 * of the real masked value).
 */
export async function updatePaymentSettings(
  patch: PaymentSettingsUpdate
): Promise<{ ok: true; settings: PaymentSettings } | { ok: false; issues: string[] }> {
  const current = await getPaymentSettings();

  // Secret fields: blank string from client = keep existing.
  const SECRET_KEYS = [
    'mellatPassword',
    'stripeSecretKey',
    'stripeWebhookSecret',
    'tapSecretKey',
    'paypalClientSecret'
  ] as const;

  const data: PaymentSettingsUpdate = { ...patch };
  for (const k of SECRET_KEYS) {
    if (k in data) {
      const v = data[k];
      if (v === '' || v === undefined) {
        delete data[k];
      }
    }
  }

  const merged: PaymentSettings = { ...current, ...data, updatedAt: new Date() };
  const issues = validatePaymentSettings(merged);
  if (issues.length > 0) return { ok: false, issues };

  const updated = await prisma.paymentSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data
  });
  invalidatePaymentSettingsCache();
  return { ok: true, settings: updated as PaymentSettings };
}
