import { Prisma } from '@prisma/client';
import type { Prisma as PrismaTypes } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  AppliedCouponDTO,
  CouponAppliesTo,
  CouponDTO,
  CouponErrorCode,
  CouponInput,
  CouponStatsDTO,
  CouponType,
  CouponUsageDTO
} from '@/types/coupon';

/**
 * Coupon service
 * --------------
 * Owns all server-side coupon logic: validation, discount computation,
 * cart attachment/detachment, and admin CRUD.
 *
 * Architectural rules (must never be violated):
 *   1. The client may only submit a `code` string. Everything else
 *      (type, value, cap, limits, expiry) is read from the DB.
 *   2. `computeDiscount` is the *only* function that converts coupon
 *      rules into a monetary amount. Callers must use it.
 *   3. `usedCount` is incremented at order-creation time (one code =
 *      one order), inside the same transaction that creates the order.
 *   4. Invalid coupons are silently dropped from a cart rather than
 *      blocking cart operations — the UI shows a non-blocking notice.
 */

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class CouponError extends Error {
  constructor(
    public code: CouponErrorCode,
    public status: number = 400,
    public details?: Record<string, string>
  ) {
    super(code);
  }
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

/** Canonical coupon code: upper-case, trimmed, spaces collapsed. */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

/** Round to 2 decimals (string → number) to avoid float drift. */
function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Compute the monetary discount applied by `coupon` against `subtotal`.
 *
 * Semantics:
 *   - PERCENTAGE: `subtotal * (value / 100)`, capped by `maxDiscount`.
 *   - FIXED:      `min(value, subtotal)` (never makes the total negative).
 *
 * Always returns a non-negative, 2-decimal value.
 */
export function computeDiscount(
  coupon: Pick<PrismaCoupon, 'type' | 'value' | 'maxDiscount'>,
  subtotal: number
): number {
  if (subtotal <= 0) return 0;
  const value = Number(coupon.value);

  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = subtotal * (value / 100);
    const cap = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null;
    if (cap != null && discount > cap) discount = cap;
  } else {
    discount = Math.min(value, subtotal);
  }

  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  return round2(discount);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

type PrismaCoupon = Prisma.CouponGetPayload<object>;

/**
 * Cart-line shape used for scope validation. Kept minimal so callers can
 * pass any join shape with `productId` + `categoryId`.
 */
export type CouponCartLine = {
  productId: string;
  categoryId: string;
  quantity: number;
  price: number;
};

export type CouponContext = {
  userId?: string;
  items?: CouponCartLine[];
};

/**
 * Validate a coupon for a given subtotal. Throws `CouponError` on failure.
 * Does not mutate anything. Stateless checks only (no DB).
 *
 * Backward-compatible: callers passing only `(coupon, subtotal)` keep
 * working. Stateful checks (perUserLimit, firstOrderOnly) require an
 * async path — see `assertCouponContextUsable` below.
 */
export function assertCouponUsable(
  coupon: PrismaCoupon,
  subtotal: number,
  ctx: CouponContext = {}
): void {
  if (!coupon.isActive) throw new CouponError('coupon_inactive', 409);
  const now = Date.now();
  if (coupon.startAt && coupon.startAt.getTime() > now) {
    throw new CouponError('coupon_not_started', 409);
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now) {
    throw new CouponError('coupon_expired', 409);
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponError('coupon_usage_limit_reached', 409);
  }
  if (
    coupon.minOrderAmount != null &&
    subtotal < Number(coupon.minOrderAmount)
  ) {
    throw new CouponError('coupon_min_order_not_met', 409);
  }

  // Scope: USER restriction is stateless — needs only ctx.userId.
  if (coupon.appliesTo === 'USER') {
    if (!ctx.userId || coupon.userId !== ctx.userId) {
      throw new CouponError('coupon_not_for_user', 409);
    }
  }
  // Scope: CATEGORY/PRODUCT need cart items.
  if (coupon.appliesTo === 'CATEGORY' && coupon.categoryId && ctx.items) {
    const hit = ctx.items.some((l) => l.categoryId === coupon.categoryId);
    if (!hit) throw new CouponError('coupon_no_matching_items', 409);
  }
  if (coupon.appliesTo === 'PRODUCT' && coupon.productId && ctx.items) {
    const hit = ctx.items.some((l) => l.productId === coupon.productId);
    if (!hit) throw new CouponError('coupon_no_matching_items', 409);
  }
}

/**
 * Stateful checks that require DB hits: perUserLimit, firstOrderOnly.
 * Call AFTER `assertCouponUsable` (or in parallel) when applying.
 */
export async function assertCouponContextUsable(
  coupon: PrismaCoupon,
  ctx: CouponContext
): Promise<void> {
  if (!ctx.userId) return;

  if (coupon.firstOrderOnly) {
    const prior = await prisma.order.count({
      where: { userId: ctx.userId, status: { not: 'CANCELLED' } }
    });
    if (prior > 0) throw new CouponError('coupon_first_order_only', 409);
  }

  if (coupon.perUserLimit != null && coupon.perUserLimit >= 0) {
    const used = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId: ctx.userId }
    });
    if (used >= coupon.perUserLimit) {
      throw new CouponError('coupon_per_user_limit_reached', 409);
    }
  }
}

/** Non-throwing variant used by the cart service to auto-drop bad coupons. */
export function isCouponUsable(
  coupon: PrismaCoupon | null,
  subtotal: number,
  ctx: CouponContext = {}
): coupon is PrismaCoupon {
  if (!coupon) return false;
  try {
    assertCouponUsable(coupon, subtotal, ctx);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

export function toAppliedDTO(
  coupon: PrismaCoupon,
  discountAmount: number
): AppliedCouponDTO {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type as CouponType,
    value: Number(coupon.value),
    discountAmount: round2(discountAmount)
  };
}

export function toAdminDTO(coupon: PrismaCoupon): CouponDTO {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type as CouponType,
    value: Number(coupon.value),
    minOrderAmount:
      coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
    maxDiscount:
      coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    isActive: coupon.isActive,
    appliesTo: coupon.appliesTo as CouponAppliesTo,
    categoryId: coupon.categoryId,
    productId: coupon.productId,
    userId: coupon.userId,
    firstOrderOnly: coupon.firstOrderOnly,
    perUserLimit: coupon.perUserLimit,
    startAt: coupon.startAt ? coupon.startAt.toISOString() : null,
    autoApply: coupon.autoApply,
    createdAt: coupon.createdAt.toISOString()
  };
}

/* ------------------------------------------------------------------ */
/* Cart integration                                                    */
/* ------------------------------------------------------------------ */

/**
 * Attach a coupon (by code) to the user's cart. Validates against the
 * cart's current subtotal and throws a `CouponError` on any failure.
 *
 * Returns the applied coupon DTO + resolved discount so callers can
 * render an optimistic UI without re-fetching the cart.
 */
export async function applyCouponByCode(params: {
  userId: string;
  code: string;
  subtotal: number;
  items?: CouponCartLine[];
}): Promise<AppliedCouponDTO> {
  if (params.subtotal <= 0) {
    throw new CouponError('cart_empty', 409);
  }

  const code = normalizeCode(params.code);
  if (!code) throw new CouponError('coupon_invalid_input', 400);

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw new CouponError('coupon_not_found', 404);

  const ctx: CouponContext = { userId: params.userId, items: params.items };
  assertCouponUsable(coupon, params.subtotal, ctx);
  await assertCouponContextUsable(coupon, ctx);

  // Atomic: set cart.couponId
  await prisma.cart.update({
    where: { userId: params.userId },
    data: { couponId: coupon.id }
  });

  const discount = computeDiscount(coupon, params.subtotal);
  return toAppliedDTO(coupon, discount);
}

/**
 * Resolve the best auto-apply coupon for the given context, or null if
 * none match. Picks the largest discount; ties break by id (deterministic).
 * Stack rule: only one coupon per cart, so this is purely additive when
 * the cart has no manual coupon attached.
 */
export async function findAutoApplyCoupon(params: {
  userId: string;
  subtotal: number;
  items: CouponCartLine[];
}): Promise<PrismaCoupon | null> {
  if (params.subtotal <= 0) return null;

  const now = new Date();
  const candidates = await prisma.coupon.findMany({
    where: {
      autoApply: true,
      isActive: true,
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      ]
    }
  });

  let best: { coupon: PrismaCoupon; discount: number } | null = null;
  for (const c of candidates) {
    const ctx: CouponContext = { userId: params.userId, items: params.items };
    if (!isCouponUsable(c, params.subtotal, ctx)) continue;
    try {
      await assertCouponContextUsable(c, ctx);
    } catch {
      continue;
    }
    const d = computeDiscount(c, params.subtotal);
    if (d <= 0) continue;
    if (!best || d > best.discount || (d === best.discount && c.id < best.coupon.id)) {
      best = { coupon: c, discount: d };
    }
  }
  return best?.coupon ?? null;
}

/**
 * Persist a redemption. Must be called inside the order-create
 * transaction so the row is rolled back on failure. The unique
 * constraint on `orderId` makes this safe to call at-most-once even
 * on retries.
 */
export async function recordCouponUsage(
  tx: PrismaTypes.TransactionClient,
  params: { couponId: string; userId: string; orderId: string }
): Promise<void> {
  await tx.couponUsage.create({
    data: {
      couponId: params.couponId,
      userId: params.userId,
      orderId: params.orderId
    }
  });
}

/** Detach any coupon from the user's cart. Idempotent. */
export async function removeCouponFromCart(userId: string): Promise<void> {
  await prisma.cart.update({
    where: { userId },
    data: { couponId: null }
  });
}

/* ------------------------------------------------------------------ */
/* Admin CRUD                                                          */
/* ------------------------------------------------------------------ */

export async function listCoupons(): Promise<CouponDTO[]> {
  const rows = await prisma.coupon.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
  });
  return rows.map(toAdminDTO);
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export async function getCouponStats(couponId: string): Promise<CouponStatsDTO> {
  const [totalUsage, agg, distinct] = await Promise.all([
    prisma.couponUsage.count({ where: { couponId } }),
    prisma.order.aggregate({
      where: { couponId },
      _sum: { discountAmount: true }
    }),
    prisma.couponUsage.findMany({
      where: { couponId },
      distinct: ['userId'],
      select: { userId: true }
    })
  ]);
  return {
    totalUsage,
    revenueImpact: agg._sum.discountAmount
      ? Number(agg._sum.discountAmount)
      : 0,
    uniqueUsers: distinct.length
  };
}

export async function listCouponUsages(
  couponId: string,
  limit = 100
): Promise<CouponUsageDTO[]> {
  const rows = await prisma.couponUsage.findMany({
    where: { couponId },
    include: {
      user: { select: { name: true, email: true } },
      order: { select: { discountAmount: true, totalPrice: true } }
    },
    orderBy: { usedAt: 'desc' },
    take: limit
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    userId: r.userId,
    userName: r.user?.name ?? null,
    userEmail: r.user?.email ?? null,
    discountAmount: Number(r.order.discountAmount),
    orderTotal: Number(r.order.totalPrice),
    usedAt: r.usedAt.toISOString()
  }));
}

export async function getCouponById(id: string): Promise<CouponDTO | null> {
  const row = await prisma.coupon.findUnique({ where: { id } });
  return row ? toAdminDTO(row) : null;
}

function validateInput(input: CouponInput): void {
  const errors: Record<string, string> = {};
  if (!input.code?.trim()) errors.code = 'required';
  else if (input.code.trim().length > 32) errors.code = 'too_long';

  if (input.type !== 'PERCENTAGE' && input.type !== 'FIXED') {
    errors.type = 'invalid';
  }

  if (
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value) ||
    input.value <= 0
  ) {
    errors.value = 'invalid';
  } else if (input.type === 'PERCENTAGE' && input.value > 100) {
    errors.value = 'percentage_out_of_range';
  }

  if (
    input.minOrderAmount != null &&
    (!Number.isFinite(input.minOrderAmount) || input.minOrderAmount < 0)
  ) {
    errors.minOrderAmount = 'invalid';
  }

  if (
    input.maxDiscount != null &&
    (!Number.isFinite(input.maxDiscount) || input.maxDiscount < 0)
  ) {
    errors.maxDiscount = 'invalid';
  }

  if (
    input.usageLimit != null &&
    (!Number.isInteger(input.usageLimit) || input.usageLimit < 0)
  ) {
    errors.usageLimit = 'invalid';
  }

  if (
    input.perUserLimit != null &&
    (!Number.isInteger(input.perUserLimit) || input.perUserLimit < 0)
  ) {
    errors.perUserLimit = 'invalid';
  }

  // Scope coherence: when appliesTo is CATEGORY/PRODUCT/USER, the
  // matching FK must be set; otherwise FKs must be cleared so the
  // index is meaningful.
  const scope = input.appliesTo ?? 'ALL';
  if (scope === 'CATEGORY' && !input.categoryId) errors.categoryId = 'required';
  if (scope === 'PRODUCT' && !input.productId) errors.productId = 'required';
  if (scope === 'USER' && !input.userId) errors.userId = 'required';

  if (Object.keys(errors).length) {
    throw new CouponError('coupon_invalid_input', 400, errors);
  }
}

/** Build the marketing-engine fields once for create/update.  */
function buildMarketingData(
  input: CouponInput
): {
  appliesTo: CouponAppliesTo;
  categoryId: string | null;
  productId: string | null;
  userId: string | null;
  firstOrderOnly: boolean;
  perUserLimit: number | null;
  startAt: Date | null;
  autoApply: boolean;
} {
  const scope = (input.appliesTo ?? 'ALL') as CouponAppliesTo;
  return {
    appliesTo: scope,
    // Clear non-matching FKs so a scope change doesn't leave stale ids.
    categoryId: scope === 'CATEGORY' ? (input.categoryId ?? null) : null,
    productId: scope === 'PRODUCT' ? (input.productId ?? null) : null,
    userId: scope === 'USER' ? (input.userId ?? null) : null,
    firstOrderOnly: Boolean(input.firstOrderOnly),
    perUserLimit: input.perUserLimit ?? null,
    startAt: input.startAt ? new Date(input.startAt) : null,
    autoApply: Boolean(input.autoApply)
  };
}

export async function createCoupon(input: CouponInput): Promise<CouponDTO> {
  validateInput(input);
  const code = normalizeCode(input.code);

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw new CouponError('coupon_code_taken', 409);

  const row = await prisma.coupon.create({
    data: {
      code,
      description: input.description?.trim() || null,
      type: input.type,
      value: new Prisma.Decimal(input.value.toFixed(2)),
      minOrderAmount:
        input.minOrderAmount != null
          ? new Prisma.Decimal(input.minOrderAmount.toFixed(2))
          : null,
      maxDiscount:
        input.maxDiscount != null
          ? new Prisma.Decimal(input.maxDiscount.toFixed(2))
          : null,
      usageLimit: input.usageLimit ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
      ...buildMarketingData(input)
    }
  });
  return toAdminDTO(row);
}

export async function updateCoupon(
  id: string,
  patch: Partial<CouponInput>
): Promise<CouponDTO> {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new CouponError('coupon_not_found', 404);

  // Partial validation — only the fields present are checked.
  const merged: CouponInput = {
    code: patch.code ?? existing.code,
    description: patch.description ?? existing.description,
    type: (patch.type ?? existing.type) as CouponType,
    value:
      patch.value != null ? patch.value : Number(existing.value),
    minOrderAmount:
      patch.minOrderAmount !== undefined
        ? patch.minOrderAmount
        : existing.minOrderAmount != null
          ? Number(existing.minOrderAmount)
          : null,
    maxDiscount:
      patch.maxDiscount !== undefined
        ? patch.maxDiscount
        : existing.maxDiscount != null
          ? Number(existing.maxDiscount)
          : null,
    usageLimit:
      patch.usageLimit !== undefined ? patch.usageLimit : existing.usageLimit,
    expiresAt:
      patch.expiresAt !== undefined
        ? patch.expiresAt
        : existing.expiresAt
          ? existing.expiresAt.toISOString()
          : null,
    isActive: patch.isActive ?? existing.isActive,
    appliesTo:
      patch.appliesTo !== undefined
        ? patch.appliesTo
        : (existing.appliesTo as CouponAppliesTo),
    categoryId:
      patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    productId:
      patch.productId !== undefined ? patch.productId : existing.productId,
    userId: patch.userId !== undefined ? patch.userId : existing.userId,
    firstOrderOnly:
      patch.firstOrderOnly !== undefined
        ? patch.firstOrderOnly
        : existing.firstOrderOnly,
    perUserLimit:
      patch.perUserLimit !== undefined
        ? patch.perUserLimit
        : existing.perUserLimit,
    startAt:
      patch.startAt !== undefined
        ? patch.startAt
        : existing.startAt
          ? existing.startAt.toISOString()
          : null,
    autoApply:
      patch.autoApply !== undefined ? patch.autoApply : existing.autoApply
  };
  validateInput(merged);

  const newCode = normalizeCode(merged.code);
  if (newCode !== existing.code) {
    const taken = await prisma.coupon.findUnique({ where: { code: newCode } });
    if (taken) throw new CouponError('coupon_code_taken', 409);
  }

  const row = await prisma.coupon.update({
    where: { id },
    data: {
      code: newCode,
      description: merged.description?.trim() || null,
      type: merged.type,
      value: new Prisma.Decimal(merged.value.toFixed(2)),
      minOrderAmount:
        merged.minOrderAmount != null
          ? new Prisma.Decimal(merged.minOrderAmount.toFixed(2))
          : null,
      maxDiscount:
        merged.maxDiscount != null
          ? new Prisma.Decimal(merged.maxDiscount.toFixed(2))
          : null,
      usageLimit: merged.usageLimit ?? null,
      expiresAt: merged.expiresAt ? new Date(merged.expiresAt) : null,
      isActive: merged.isActive ?? true,
      ...buildMarketingData(merged)
    }
  });
  return toAdminDTO(row);
}

export async function deleteCoupon(id: string): Promise<void> {
  // Orders & carts use SetNull on coupon delete, so this is safe —
  // historical orders retain their `couponCode` snapshot.
  await prisma.coupon.delete({ where: { id } });
}
