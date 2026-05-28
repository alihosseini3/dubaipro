import { getDisplayContext } from '@/lib/currency/context';
import {
  asCurrency,
  formatDisplay,
  formatDisplayFromAED
} from '@/lib/currency/service';
import type { Currency } from '@/types/currency';
import { BASE_CURRENCY } from '@/types/currency';

type PriceProps = {
  /** Amount in `from` currency (default: AED — the canonical storage unit). */
  amount: number;
  /** Locale of the current request. Drives both conversion and formatting. */
  locale: string;
  /**
   * Source currency for `amount`. Defaults to AED. Pass the product's stored
   * currency to handle legacy rows that predate the AED-only policy.
   */
  from?: Currency | string | null;
  /** Optional wrapper tag (defaults to <span>). */
  as?: 'span' | 'div' | 'strong';
  className?: string;
};

/**
 * Server component that renders a price in the user's locale currency.
 *
 * It reads FX rates once per request (cached via `getDisplayContext`) so a
 * page rendering dozens of prices does not cause N queries.
 */
export async function Price({
  amount,
  locale,
  from,
  as: Tag = 'span',
  className
}: PriceProps) {
  const { display, rates } = await getDisplayContext(locale);
  const fromCurrency = asCurrency(typeof from === 'string' ? from : from ?? null) ?? BASE_CURRENCY;

  const text =
    fromCurrency === BASE_CURRENCY
      ? formatDisplayFromAED(amount, display)
      : formatDisplay(amount, fromCurrency, display, rates);

  return <Tag className={className}>{text}</Tag>;
}
