import 'server-only';

import { prisma } from '@/lib/prisma';
import type { Currency } from '@/types/currency';
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from '@/types/currency';

/**
 * Static fallback rates — used when the DB has no override for a currency.
 *
 * Each value is: "how many units of the target currency equal 1 AED".
 * Example: 1 AED ≈ 0.2723 USD  →  USD: 0.2723
 * Example: 1 AED ≈ 11,450 IRR  →  IRR: 11450   (≈ 1,145 Toman)
 *
 * These defaults are safe for development and degrade gracefully if the
 * `CurrencyRate` table is empty or unreachable. Production deployments
 * should override them via the admin panel (or a future live FX job).
 */
export const DEFAULT_RATES: Record<Currency, number> = {
  AED: 1,
  USD: 0.2723,
  IRR: 11450
};

type RatesMap = Record<Currency, number>;

type CurrencyRateRow = {
  id: string;
  base: string;
  target: string;
  rate: unknown;
  updatedAt: Date;
};

/**
 * Minimal typed handle over the (possibly ungenerated) `prisma.currencyRate`
 * delegate. Keeping the cast in one place means the rest of the module stays
 * type-clean even before `prisma generate` has been run against the new
 * `{ base, target }` schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rateClient = () =>
  (prisma as unknown as {
    currencyRate: {
      findMany: (args?: unknown) => Promise<CurrencyRateRow[]>;
      upsert: (args: unknown) => Promise<CurrencyRateRow>;
      findUnique: (args: unknown) => Promise<CurrencyRateRow | null>;
    };
    currencyRateHistory: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<Array<{
        id: string;
        rate: unknown;
        source: string;
        changedBy: string | null;
        createdAt: Date;
      }>>;
    };
  }).currencyRate;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const historyClient = () =>
  (prisma as unknown as {
    currencyRateHistory: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<Array<{
        id: string;
        rate: unknown;
        source: string;
        changedBy: string | null;
        createdAt: Date;
      }>>;
    };
  }).currencyRateHistory;

/**
 * Read all FX rates, merging DB overrides (where `base = BASE_CURRENCY`) on
 * top of {@link DEFAULT_RATES}. Always returns a complete map for every
 * {@link SUPPORTED_CURRENCIES} entry so downstream code never has to
 * null-check.
 *
 * Fail-open: on DB error, returns defaults so the storefront keeps rendering.
 */
export async function getRates(): Promise<RatesMap> {
  const map: RatesMap = { ...DEFAULT_RATES };
  try {
    const rows = await rateClient().findMany({
      where: { base: BASE_CURRENCY }
    });
    for (const row of rows) {
      if ((SUPPORTED_CURRENCIES as readonly string[]).includes(row.target)) {
        const rate = Number(row.rate);
        if (Number.isFinite(rate) && rate > 0) {
          map[row.target as Currency] = rate;
        }
      }
    }
  } catch {
    // swallow — defaults already populated
  }
  return map;
}

/**
 * Read a single target rate with the same fallback semantics as
 * {@link getRates}. Always quoted against {@link BASE_CURRENCY}.
 */
export async function getRate(target: Currency): Promise<number> {
  const rates = await getRates();
  return rates[target] ?? DEFAULT_RATES[target];
}

/**
 * Admin-only: upsert an override for `(BASE_CURRENCY, target)` and append an
 * immutable history row. The history write is best-effort and must never
 * block the main upsert — if the table isn't migrated yet we swallow silently.
 *
 * @param target    ISO code of the target currency.
 * @param rate      Positive finite number of target units per 1 base unit.
 * @param source    Origin of the change ("manual" | "api" | "seed"). Stored
 *                  verbatim on the history row for later analytics.
 * @param changedBy Admin user id performing the change.
 */
export async function setRate(
  target: Currency,
  rate: number,
  source: string = 'manual',
  changedBy: string | null = null
): Promise<void> {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(target)) {
    throw new Error(`unsupported_currency:${target}`);
  }
  if (target === BASE_CURRENCY) {
    throw new Error('base_currency_immutable');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('invalid_rate');
  }

  const row = await rateClient().upsert({
    where: { base_target: { base: BASE_CURRENCY, target } },
    update: { rate },
    create: { base: BASE_CURRENCY, target, rate }
  });

  try {
    await historyClient().create({
      data: {
        rateId: row.id,
        base: BASE_CURRENCY,
        target,
        rate,
        source,
        changedBy
      }
    });
  } catch {
    // History is additive — losing a row is acceptable when the table is
    // missing or under pressure.
  }
}

/**
 * List every supported currency with its current rate + metadata (for the
 * admin UI). Rates without a DB row are reported with `isDefault: true`.
 */
export async function listRates(): Promise<
  Array<{
    code: Currency;
    rate: number;
    updatedAt: string | null;
    isDefault: boolean;
  }>
> {
  const rows = await rateClient()
    .findMany({ where: { base: BASE_CURRENCY } })
    .catch(() => [] as CurrencyRateRow[]);

  const byTarget = new Map(rows.map((r) => [r.target, r]));

  return SUPPORTED_CURRENCIES.map((code) => {
    const row = byTarget.get(code);
    if (row) {
      return {
        code,
        rate: Number(row.rate),
        updatedAt: row.updatedAt.toISOString(),
        isDefault: false
      };
    }
    return {
      code,
      rate: DEFAULT_RATES[code],
      updatedAt: null,
      isDefault: true
    };
  });
}

/**
 * Read the most recent N history entries for a given target pair.
 * Useful for rendering a "recent changes" list next to the edit form.
 */
export async function listRateHistory(
  target: Currency,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    rate: number;
    source: string;
    changedBy: string | null;
    createdAt: string;
  }>
> {
  try {
    const rows = await historyClient().findMany({
      where: { base: BASE_CURRENCY, target },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 100))
    });
    return rows.map((r) => ({
      id: r.id,
      rate: Number(r.rate),
      source: r.source,
      changedBy: r.changedBy,
      createdAt: r.createdAt.toISOString()
    }));
  } catch {
    return [];
  }
}
