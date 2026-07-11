import 'server-only';

import { unstable_cache } from 'next/cache';
import { Prisma, SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  notifyMany,
  orgMemberIdsWithPermission
} from '@/lib/notifications/service';

/**
 * Supplier subscription engine.
 *
 * Invariant: every supplier has EXACTLY ONE ACTIVE/TRIAL subscription.
 * Enforced by:
 *   - `getActiveSubscription` self-heal (auto-subscribes to FREE on miss —
 *     covers suppliers created after the seed, same pattern as the
 *     OWNER-membership self-heal in require-supplier.ts)
 *   - `assignPlan` running cancel + create in one transaction
 *   - the seed script's reconciliation query
 *
 * Billing v1 is admin-assigned; rows are append-only history.
 */

export class SubscriptionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SubscriptionError';
    this.status = status;
  }
}

export const FREE_PLAN_CODE = 'FREE';

const PLAN_SELECT = {
  id: true,
  code: true,
  nameTranslations: true,
  price: true,
  currency: true,
  intervalMonths: true,
  maxProducts: true,
  maxEmployees: true,
  maxImagesPerProduct: true,
  features: true,
  isActive: true,
  sortOrder: true
} satisfies Prisma.SubscriptionPlanSelect;

const SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  startedAt: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  plan: { select: PLAN_SELECT }
} satisfies Prisma.SupplierSubscriptionSelect;

export { resolvePeriodEnd } from './pure';
import { resolvePeriodEnd } from './pure';

export const PLANS_CACHE_TAG = 'plans';

const listActivePlansCached = unstable_cache(
  async () =>
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: PLAN_SELECT
    }),
  ['list-active-plans'],
  { tags: [PLANS_CACHE_TAG], revalidate: 300 }
);

/**
 * Plans change rarely and render on public comparison tables — the
 * active-only read is tag-cached (busted by the admin plan mutations).
 * The admin view (includeInactive) always reads fresh.
 */
export async function listPlans(includeInactive = false) {
  if (!includeInactive) return listActivePlansCached();
  return prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    select: PLAN_SELECT
  });
}

/**
 * The supplier's current subscription. Self-heals to FREE so the invariant
 * holds even for orgs created after the seed ran.
 */
export async function getActiveSubscription(supplierId: string) {
  const existing = await prisma.supplierSubscription.findFirst({
    where: {
      supplierId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
    },
    orderBy: { createdAt: 'desc' },
    select: SUBSCRIPTION_SELECT
  });
  if (existing) return existing;

  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { code: FREE_PLAN_CODE },
    select: { id: true }
  });
  if (!freePlan) {
    throw new SubscriptionError(
      'FREE plan is not seeded — run scripts/seed-subscription-plans.mjs',
      500
    );
  }
  return prisma.supplierSubscription.create({
    data: { supplierId, planId: freePlan.id, currentPeriodEnd: null },
    select: SUBSCRIPTION_SELECT
  });
}

/**
 * Admin-assigned plan change. Cancels the current ACTIVE/TRIAL row and
 * creates the new one atomically; notifies the org.
 */
export async function assignPlan(params: {
  adminId: string;
  supplierId: string;
  planId: string;
  /** Override the plan's interval; ignored for FREE (never expires). */
  periodMonths?: number;
}) {
  const [supplier, plan] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: params.supplierId },
      select: { id: true, name: true }
    }),
    prisma.subscriptionPlan.findUnique({
      where: { id: params.planId },
      select: { id: true, code: true, intervalMonths: true, isActive: true }
    })
  ]);
  if (!supplier) throw new SubscriptionError('Supplier not found', 404);
  if (!plan) throw new SubscriptionError('Plan not found', 404);
  if (!plan.isActive) throw new SubscriptionError('Plan is not active', 400);

  const months = params.periodMonths ?? plan.intervalMonths;
  const periodEnd =
    plan.code === FREE_PLAN_CODE ? null : resolvePeriodEnd(months);

  const [, subscription] = await prisma.$transaction([
    prisma.supplierSubscription.updateMany({
      where: {
        supplierId: params.supplierId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
      },
      data: { status: SubscriptionStatus.CANCELED }
    }),
    prisma.supplierSubscription.create({
      data: {
        supplierId: params.supplierId,
        planId: params.planId,
        currentPeriodEnd: periodEnd,
        assignedById: params.adminId
      },
      select: SUBSCRIPTION_SELECT
    })
  ]);

  void orgMemberIdsWithPermission(params.supplierId, 'supplier.subscription.view')
    .then((userIds) =>
      notifyMany(
        userIds,
        'subscription.assigned',
        {
          planCode: subscription.plan.code,
          periodEnd: periodEnd ? periodEnd.toISOString().slice(0, 10) : '-'
        },
        { link: '/supplier/subscription' }
      )
    )
    .catch(() => {});

  return subscription;
}

/* ─── Plan CRUD (admin) ──────────────────────────────────────────────────── */

export type PlanInput = {
  code: string;
  nameTranslations: Record<string, string>;
  price: number;
  currency: string;
  intervalMonths: number;
  maxProducts: number | null;
  maxEmployees: number | null;
  maxImagesPerProduct: number | null;
  features?: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
};

export async function createPlan(input: PlanInput) {
  return prisma.subscriptionPlan.create({
    data: {
      ...input,
      features: (input.features ?? undefined) as Prisma.InputJsonValue | undefined
    },
    select: PLAN_SELECT
  });
}

export async function updatePlan(id: string, patch: Partial<PlanInput>) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    select: { code: true }
  });
  if (!plan) throw new SubscriptionError('Plan not found', 404);
  if (patch.code && patch.code !== plan.code && plan.code === FREE_PLAN_CODE) {
    // The FREE code is the self-heal anchor — renaming it would break the invariant.
    throw new SubscriptionError('The FREE plan code cannot be changed', 400);
  }
  return prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...patch,
      features: (patch.features ?? undefined) as Prisma.InputJsonValue | undefined
    },
    select: PLAN_SELECT
  });
}

/* ─── Admin subscription overview ────────────────────────────────────────── */

export async function listSupplierSubscriptions(params: {
  page: number;
  pageSize: number;
  q?: string;
}) {
  const where: Prisma.SupplierWhereInput = params.q
    ? { name: { contains: params.q, mode: 'insensitive' } }
    : {};
  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        name: true,
        subscriptions: {
          where: {
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: SUBSCRIPTION_SELECT
        }
      }
    }),
    prisma.supplier.count({ where })
  ]);
  return {
    items: items.map((s) => ({
      supplierId: s.id,
      supplierName: s.name,
      subscription: s.subscriptions[0] ?? null
    })),
    total
  };
}

/* ─── Expiry cron ────────────────────────────────────────────────────────── */

const EXPIRY_WARNING_DAYS = 7;

/**
 * Daily cron:
 *   1. Warn subscriptions entering the 7-day expiry window (one-day slice →
 *      fires exactly once per subscription).
 *   2. Expire overdue subscriptions and auto-downgrade the org to FREE
 *      (grandfathering: nothing existing is hidden — only new creates are
 *      blocked by the FREE limits).
 */
export async function runSubscriptionExpiry(now: Date = new Date()) {
  const windowStart = new Date(now.getTime() + (EXPIRY_WARNING_DAYS - 1) * 86_400_000);
  const windowEnd = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

  const expiring = await prisma.supplierSubscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { gte: windowStart, lt: windowEnd }
    },
    select: {
      supplierId: true,
      currentPeriodEnd: true,
      plan: { select: { code: true } }
    }
  });
  for (const sub of expiring) {
    void orgMemberIdsWithPermission(sub.supplierId, 'supplier.subscription.view')
      .then((userIds) =>
        notifyMany(
          userIds,
          'subscription.expiring',
          {
            planCode: sub.plan.code,
            periodEnd: sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? '-'
          },
          { link: '/supplier/subscription' }
        )
      )
      .catch(() => {});
  }

  const due = await prisma.supplierSubscription.findMany({
    where: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: { lt: now } },
    select: { id: true, supplierId: true, plan: { select: { code: true } } }
  });

  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { code: FREE_PLAN_CODE },
    select: { id: true }
  });

  let expired = 0;
  for (const sub of due) {
    await prisma.$transaction([
      prisma.supplierSubscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED }
      }),
      ...(freePlan
        ? [
            prisma.supplierSubscription.create({
              data: {
                supplierId: sub.supplierId,
                planId: freePlan.id,
                currentPeriodEnd: null
              }
            })
          ]
        : [])
    ]);
    expired += 1;
    void orgMemberIdsWithPermission(sub.supplierId, 'supplier.subscription.view')
      .then((userIds) =>
        notifyMany(
          userIds,
          'subscription.expired',
          { planCode: sub.plan.code },
          { link: '/supplier/subscription' }
        )
      )
      .catch(() => {});
  }

  return { warned: expiring.length, expired };
}
