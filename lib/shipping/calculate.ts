/**
 * Centralized Shipping Calculation Engine.
 *
 * Stays backward-compatible with legacy `ShippingMethod.price` (flat) when
 * the rule-engine fields (basePrice / pricePerKg) are not configured.
 *
 * Algorithm:
 *   1. actualWeight   = Σ (item.weight × qty)
 *   2. volumetricKg   = Σ ((L×W×H) / factor × qty)   when enabled
 *   3. billableWeight = max(actualWeight, volumetricKg)
 *   4. Pick best method:  zone-match  →  class-match  →  global  →  flat
 *   5. cost = basePrice + billableWeight × pricePerKg
 *           OR fallback to flat `price` (legacy methods)
 *   6. round per settings.roundingStrategy (ceil | round)
 *
 * Designed to be:
 *   - SAFE: never throws on missing data; always returns a quote.
 *   - FAST: single Prisma query for methods + cached settings per request.
 *   - PURE: no I/O outside the explicit DB reads at the top.
 */

import { prisma } from '@/lib/prisma';
import type {
  ShippingItemInput,
  ShippingQuoteBreakdown,
  ShippingSettingsDTO
} from '@/types/shipping';
import { findZoneForCountry } from '@/lib/shipping/service';

const DEFAULT_SETTINGS: ShippingSettingsDTO = {
  defaultVolumetricFactor: 5000,
  enableVolumetric: false,
  roundingStrategy: 'ceil'
};

// Per-request memoisation (Node module scope is per-server-request in dev,
// per-instance in prod — fine for read-mostly settings).
let _cachedSettings: { value: ShippingSettingsDTO; at: number } | null = null;
const SETTINGS_TTL_MS = 30_000;

export async function getShippingSettings(): Promise<ShippingSettingsDTO> {
  const now = Date.now();
  if (_cachedSettings && now - _cachedSettings.at < SETTINGS_TTL_MS) {
    return _cachedSettings.value;
  }
  try {
    const row = await prisma.shippingSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' }
    });
    const value: ShippingSettingsDTO = {
      defaultVolumetricFactor: row.defaultVolumetricFactor || 5000,
      enableVolumetric: row.enableVolumetric,
      roundingStrategy:
        row.roundingStrategy === 'round' ? 'round' : 'ceil'
    };
    _cachedSettings = { value, at: now };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateShippingSettings(
  patch: Partial<ShippingSettingsDTO>
): Promise<ShippingSettingsDTO> {
  const data: Record<string, unknown> = {};
  if (typeof patch.defaultVolumetricFactor === 'number' && patch.defaultVolumetricFactor > 0) {
    data.defaultVolumetricFactor = patch.defaultVolumetricFactor;
  }
  if (typeof patch.enableVolumetric === 'boolean') {
    data.enableVolumetric = patch.enableVolumetric;
  }
  if (patch.roundingStrategy === 'ceil' || patch.roundingStrategy === 'round') {
    data.roundingStrategy = patch.roundingStrategy;
  }
  const row = await prisma.shippingSettings.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data }
  });
  _cachedSettings = null; // invalidate
  return {
    defaultVolumetricFactor: row.defaultVolumetricFactor || 5000,
    enableVolumetric: row.enableVolumetric,
    roundingStrategy: row.roundingStrategy === 'round' ? 'round' : 'ceil'
  };
}

function round(n: number, mode: 'ceil' | 'round'): number {
  return mode === 'ceil' ? Math.ceil(n * 100) / 100 : Math.round(n * 100) / 100;
}

function sumActualWeight(items: ShippingItemInput[]): number {
  return items.reduce(
    (s, it) => s + (Number(it.weight) || 0) * (it.quantity || 0),
    0
  );
}

function sumVolumetricWeight(
  items: ShippingItemInput[],
  factor: number
): number {
  if (factor <= 0) return 0;
  return items.reduce((s, it) => {
    const l = Number(it.length) || 0;
    const w = Number(it.width) || 0;
    const h = Number(it.height) || 0;
    if (l <= 0 || w <= 0 || h <= 0) return s;
    return s + ((l * w * h) / factor) * (it.quantity || 0);
  }, 0);
}

function dominantClass(items: ShippingItemInput[]): string | null {
  // Most common non-empty shippingClass; ties → first seen.
  const counts = new Map<string, number>();
  for (const it of items) {
    const c = (it.shippingClass || '').trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + (it.quantity || 1));
  }
  let best: string | null = null;
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      best = k;
      max = v;
    }
  }
  return best;
}

type MethodRow = {
  id: string;
  name: string;
  estimatedDays: number;
  zoneId: string | null;
  price: { toString(): string }; // Prisma.Decimal
  basePrice: { toString(): string } | null;
  pricePerKg: { toString(): string } | null;
  minWeight: number | null;
  maxWeight: number | null;
  volumetricFactor: number | null;
  shippingClass: string | null;
  sortOrder: number;
};

function num(d: { toString(): string } | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : null;
}

function methodFallback(m: MethodRow): ShippingQuoteBreakdown['fallback'] {
  if (m.basePrice !== null || m.pricePerKg !== null) {
    if (m.shippingClass) return 'class';
    if (m.zoneId) return 'specific';
    return 'global';
  }
  return 'flat';
}

/**
 * Score a method against the cart context. Higher = better match.
 * Used to deterministically rank candidate methods before pricing.
 */
function scoreMethod(
  m: MethodRow,
  ctx: { zoneId: string | null; cartClass: string | null; weight: number }
): number {
  let score = 0;
  // Zone-specific beats global.
  if (ctx.zoneId && m.zoneId === ctx.zoneId) score += 100;
  else if (!m.zoneId) score += 10;
  else return -1; // wrong zone
  // Class-specific beats unset.
  if (ctx.cartClass && m.shippingClass === ctx.cartClass) score += 50;
  else if (!m.shippingClass) score += 5;
  else return -1; // wrong class
  // Weight bracket match.
  if (m.minWeight !== null && ctx.weight < m.minWeight) return -1;
  if (m.maxWeight !== null && ctx.weight > m.maxWeight) return -1;
  if (m.minWeight !== null || m.maxWeight !== null) score += 20;
  // Lower sortOrder wins on ties.
  score -= m.sortOrder * 0.001;
  return score;
}

export type CalculateInput = {
  country: string;
  items: ShippingItemInput[];
  /** When provided, force this method (still re-priced through engine). */
  methodId?: string | null;
};

export type CalculateResult = {
  quote: ShippingQuoteBreakdown | null;
  /** Other ranked candidates the customer can pick at checkout. */
  candidates: ShippingQuoteBreakdown[];
};

/**
 * Public API. Always returns gracefully — `quote: null` only when no
 * shipping methods exist at all (truly empty config).
 */
export async function calculateShipping(
  input: CalculateInput
): Promise<CalculateResult> {
  const settings = await getShippingSettings();
  const zone = await findZoneForCountry(input.country).catch(() => null);
  const cartClass = dominantClass(input.items);

  const actualWeight = sumActualWeight(input.items);

  // Load candidate methods in one query.
  const where: Record<string, unknown> = { isActive: true };
  if (zone) {
    where.OR = [{ zoneId: null }, { zoneId: zone.id }];
  } else {
    where.zoneId = null;
  }
  const methods = (await prisma.shippingMethod.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }]
  })) as unknown as MethodRow[];

  if (methods.length === 0) {
    return { quote: null, candidates: [] };
  }

  function priceOne(m: MethodRow): ShippingQuoteBreakdown {
    const factor =
      (m.volumetricFactor && m.volumetricFactor > 0
        ? m.volumetricFactor
        : settings.defaultVolumetricFactor) || 5000;
    const volumetric = settings.enableVolumetric
      ? sumVolumetricWeight(input.items, factor)
      : 0;
    const billable = Math.max(actualWeight, volumetric);

    const basePrice = num(m.basePrice);
    const perKg = num(m.pricePerKg);
    const flat = num(m.price) ?? 0;

    let total: number;
    if (basePrice !== null || perKg !== null) {
      const b = basePrice ?? 0;
      const w = (perKg ?? 0) * billable;
      total = b + w;
    } else {
      // Legacy flat fallback.
      total = flat;
    }
    total = round(Math.max(0, total), settings.roundingStrategy);

    return {
      methodId: m.id,
      methodName: m.name,
      estimatedDays: m.estimatedDays,
      actualWeight: round(actualWeight, 'round'),
      volumetricWeight: round(volumetric, 'round'),
      billableWeight: round(billable, 'round'),
      basePrice: basePrice ?? (perKg !== null ? 0 : flat),
      weightCost: perKg !== null ? round((perKg ?? 0) * billable, settings.roundingStrategy) : 0,
      total,
      rounding: settings.roundingStrategy,
      fallback: methodFallback(m)
    };
  }

  // Rank candidates so the picker UI shows them in the same order the
  // engine considers "most appropriate" first.
  const ranked = methods
    .map((m) => ({
      m,
      score: scoreMethod(m, {
        zoneId: zone?.id ?? null,
        cartClass,
        weight: actualWeight
      })
    }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score);

  const candidates = ranked.map((r) => priceOne(r.m));

  let quote: ShippingQuoteBreakdown | null = null;
  if (input.methodId) {
    const forced = methods.find((m) => m.id === input.methodId);
    if (forced) quote = priceOne(forced);
  }
  if (!quote) quote = candidates[0] ?? null;

  return { quote, candidates };
}
