import 'server-only';

import { cache } from 'react';

import type { Currency, DisplayCurrency } from '@/types/currency';

import { readCurrencyCookie } from './cookie';
import { getRates } from './rates';
import { getUserCurrency } from './service';

/**
 * Resolve the active display currency. Cookie override (set by the
 * header `<CurrencySwitcher>`) wins; otherwise locale default.
 */
async function resolveCurrency(locale: string): Promise<Currency> {
  const override = await readCurrencyCookie();
  return override ?? getUserCurrency(locale);
}

/**
 * Build a {@link DisplayCurrency} snapshot for the given locale. The snapshot
 * is pure JSON and can be passed as a prop to any Client Component.
 *
 * `cache()` dedupes concurrent calls within a single request so a page with
 * many price-rendering components still reads rates exactly once.
 */
export const getDisplayCurrency = cache(
  async (locale: string): Promise<DisplayCurrency> => {
    const code = await resolveCurrency(locale);
    const rates = await getRates();
    return {
      code,
      locale,
      rateFromAED: rates[code] ?? 1
    };
  }
);

/**
 * Server-only helper that returns both the display snapshot and the raw
 * rates map, for pages that also need to convert from non-AED currencies
 * (e.g. legacy `product.currency === 'USD'` rows).
 */
export const getDisplayContext = cache(
  async (
    locale: string
  ): Promise<{
    display: DisplayCurrency;
    rates: Record<Currency, number>;
  }> => {
    const rates = await getRates();
    const code = await resolveCurrency(locale);
    return {
      display: { code, locale, rateFromAED: rates[code] ?? 1 },
      rates
    };
  }
);
