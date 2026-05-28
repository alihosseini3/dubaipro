import 'server-only';

import { getPaymentSettings, type PaymentSettings } from './settings';

/**
 * Payment-method catalog.
 *
 * Definitions (countries, UI kind, logos) are static, but the
 * `enabled` flag and any user-facing credentials are pulled from the
 * `PaymentSettings` singleton in the DB so the admin panel can toggle
 * gateways at runtime without redeploying.
 *
 * The provider implementations in `./registry.ts` resolve the actual
 * gateway logic from a method code.
 */

export type PaymentMethodKind =
  | 'redirect' // gateway-hosted (Stripe Checkout, Mellat, Zarinpal)
  | 'embedded' // gateway intent + client SDK (Stripe Elements, Tap)
  | 'manual'; //  bank/card transfer awaiting admin review

export type PaymentMethodCode =
  | 'STRIPE'
  | 'TAP'
  | 'PAYPAL'
  | 'MELLAT'
  | 'ZARINPAL'
  | 'CARD_TRANSFER'
  | 'BANK_TRANSFER';

export type PaymentMethodDef = {
  code: PaymentMethodCode;
  /** Provider key used by the registry (./registry.ts). */
  provider: string;
  kind: PaymentMethodKind;
  /** ISO 3166-1 alpha-2 codes; `*` = any country. */
  countries: string[] | '*';
  /** Logo path under `/public`. Optional → falls back to text-only. */
  logo?: string;
  /** i18n key suffix under `checkout.methods.<code>` (label/desc). */
  i18nKey: string;
  /** When false, the method is hidden from the picker. */
  enabled: boolean;
};

/**
 * The order here is the order shown in the picker by default. Region
 * filtering happens in `methodsForCountry` below.
 */
type StaticDef = Omit<PaymentMethodDef, 'enabled'>;

const STATIC_METHODS: StaticDef[] = [
  // ---------------- Iran ----------------
  { code: 'MELLAT', provider: 'mellat', kind: 'redirect', countries: ['IR'], logo: '/payments/mellat.svg', i18nKey: 'mellat' },
  { code: 'ZARINPAL', provider: 'zarinpal', kind: 'redirect', countries: ['IR'], logo: '/payments/zarinpal.svg', i18nKey: 'zarinpal' },
  { code: 'CARD_TRANSFER', provider: 'manual', kind: 'manual', countries: ['IR'], i18nKey: 'cardTransfer' },
  // ---------------- International -------
  { code: 'STRIPE', provider: 'stripe', kind: 'redirect', countries: '*', logo: '/payments/stripe.svg', i18nKey: 'stripe' },
  { code: 'TAP', provider: 'tap', kind: 'redirect', countries: ['AE', 'SA', 'KW', 'BH', 'QA', 'OM'], logo: '/payments/tap.svg', i18nKey: 'tap' },
  { code: 'PAYPAL', provider: 'paypal', kind: 'redirect', countries: '*', logo: '/payments/paypal.svg', i18nKey: 'paypal' },
  { code: 'BANK_TRANSFER', provider: 'manual', kind: 'manual', countries: '*', i18nKey: 'bankTransfer' }
];

function isEnabled(code: PaymentMethodCode, s: PaymentSettings): boolean {
  switch (code) {
    case 'MELLAT': return s.enableMellat && Boolean(s.mellatTerminalId);
    case 'ZARINPAL': return s.enableZarinpal && Boolean(s.zarinpalMerchantId);
    case 'CARD_TRANSFER': return s.enableCardTransfer && Boolean(s.cardNumber);
    case 'STRIPE': return s.enableStripe && Boolean(s.stripeSecretKey);
    case 'TAP': return s.enableTap && Boolean(s.tapSecretKey);
    case 'PAYPAL': return s.enablePaypal && Boolean(s.paypalClientId && s.paypalClientSecret);
    case 'BANK_TRANSFER': return s.enableBankTransfer && Boolean(s.iban);
  }
}

export async function getPaymentMethods(): Promise<PaymentMethodDef[]> {
  const settings = await getPaymentSettings();
  return STATIC_METHODS.map((m) => ({ ...m, enabled: isEnabled(m.code, settings) }));
}

function normalizeCountry(c: string): string {
  return c.trim().toUpperCase();
}

export async function methodsForCountry(country: string): Promise<PaymentMethodDef[]> {
  const code = normalizeCountry(country);
  const list = await getPaymentMethods();
  return list.filter((m) => {
    if (!m.enabled) return false;
    if (m.countries === '*') return true;
    return m.countries.includes(code);
  });
}

export async function getMethod(code: string): Promise<PaymentMethodDef | null> {
  const list = await getPaymentMethods();
  return list.find((m) => m.code === code) ?? null;
}

/**
 * Bank-account info shown to the user for manual transfers. All values
 * come from the `PaymentSettings` singleton (admin-managed).
 */
export type ManualAccountInfo = {
  bankName: string;
  accountHolder: string;
  /** For CARD_TRANSFER: 16-digit card number. For BANK_TRANSFER: IBAN. */
  reference: string;
  notes?: string;
};

export async function getManualAccountInfo(
  code: 'CARD_TRANSFER' | 'BANK_TRANSFER'
): Promise<ManualAccountInfo | null> {
  const s = await getPaymentSettings();
  const reference = code === 'CARD_TRANSFER' ? s.cardNumber : s.iban;
  if (!reference) return null;
  return {
    bankName: s.bankName ?? 'Bank',
    accountHolder: s.accountHolder ?? '',
    reference,
    notes: s.manualNotes ?? undefined
  };
}
