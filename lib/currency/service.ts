import type { Currency, DisplayCurrency } from '@/types/currency';
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from '@/types/currency';

/**
 * Pure, isomorphic currency utilities.
 *
 * No I/O, no `prisma`, no `server-only`. Safe to import from both Server
 * Components and Client Components. The server is responsible for fetching
 * live rates (see `lib/currency/rates.ts`) and handing a serialized
 * {@link DisplayCurrency} to any client that needs to format.
 */

/**
 * Map of UI locale → preferred display currency.
 * Kept intentionally small; add an entry here to support a new locale.
 */
const LOCALE_CURRENCY: Record<string, Currency> = {
  en: 'AED',
  ar: 'AED',
  ur: 'AED',
  fa: 'IRR'
};

/**
 * Resolve the user's display currency from the active locale.
 * Falls back to {@link BASE_CURRENCY} for unknown locales.
 */
export function getUserCurrency(locale: string): Currency {
  return LOCALE_CURRENCY[locale] ?? BASE_CURRENCY;
}

/**
 * Convert `amount` from currency `from` to currency `to` using `rates`,
 * where `rates[x]` is "how many units of `x` equal 1 AED".
 *
 * Uses AED as the pivot so we never need `rates.length ** 2` entries.
 */
export function convertPrice(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  const aed = amount / fromRate;
  return aed * toRate;
}

/**
 * IRR is quoted to the public in Toman (= IRR / 10). This helper normalizes
 * a raw IRR amount to the unit we actually want to display.
 */
function toTomanUnits(irrAmount: number): number {
  return irrAmount / 10;
}

/**
 * Convert a locale like `fa` or `en` into an `Intl`-friendly tag.
 * `Intl.NumberFormat` is tolerant of short codes, but a regional tag gives
 * consistent grouping separators across platforms.
 */
function intlLocale(locale: string): string {
  switch (locale) {
    case 'fa':
      return 'fa-IR';
    case 'ar':
      return 'ar-AE';
    case 'ur':
      return 'ur-PK';
    case 'en':
    default:
      return 'en-AE';
  }
}

/**
 * Format `amount` (already expressed in `currency`) for the given locale.
 *
 * Special cases:
 *   - `IRR` is rendered as Toman (value / 10) with no fraction digits.
 *   - Any failure in `Intl.NumberFormat` degrades to `"<amount> <code>"`.
 */
export function formatPrice(
  amount: number,
  currency: Currency,
  locale: string
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  if (currency === 'IRR') {
    const toman = toTomanUnits(safeAmount);
    // Toman is never shown with decimals in practice.
    const rounded = Math.round(toman);
    const formatted = new Intl.NumberFormat(intlLocale(locale), {
      maximumFractionDigits: 0
    }).format(rounded);
    return `${formatted} ${getCurrencySymbol('IRR', locale)}`;
  }

  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      currencyDisplay: 'symbol'
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${currency}`;
  }
}

/**
 * Localized short symbol for a currency. Used as a suffix/prefix when we want
 * finer control than what `Intl` gives us (e.g. the "Toman" label).
 */
export function getCurrencySymbol(currency: Currency, locale: string): string {
  if (currency === 'IRR') {
    // Persian users expect تومان rather than ریال.
    if (locale === 'fa') return 'تومان';
    if (locale === 'ar') return 'تومان';
    return 'Toman';
  }
  try {
    const parts = new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol'
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency');
    if (sym?.value) return sym.value;
  } catch {
    /* fallthrough */
  }
  return currency;
}

/**
 * Format an amount that's stored in AED for the user's display currency.
 * This is the one-stop helper every UI surface should call.
 */
export function formatDisplayFromAED(
  amountAED: number,
  display: DisplayCurrency
): string {
  const converted = (amountAED ?? 0) * (display.rateFromAED ?? 1);
  return formatPrice(converted, display.code, display.locale);
}

/**
 * Format an amount stored in an arbitrary `from` currency (e.g. product rows
 * with legacy currency strings) for the display currency.
 */
export function formatDisplay(
  amount: number,
  from: Currency,
  display: DisplayCurrency,
  rates: Record<Currency, number>
): string {
  const converted = convertPrice(amount, from, display.code, rates);
  return formatPrice(converted, display.code, display.locale);
}

/**
 * Narrow a raw string to a {@link Currency} union. Returns `null` when the
 * input isn't a supported currency — callers should fall back to the base.
 */
export function asCurrency(value: string | null | undefined): Currency | null {
  if (!value) return null;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : null;
}
