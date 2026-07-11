import 'server-only';

import { ProductStatus, SupplierMemberRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { getActiveSubscription } from './service';
import { isWithinLimit } from './pure';

export { isWithinLimit } from './pure';

/**
 * Plan-limit enforcement at the hot paths (product create, team invite).
 *
 * Grandfathering rule: limits only block NEW creations. A supplier already
 * over a cap (after a downgrade) keeps everything visible — they just can't
 * add more until they upgrade or trim.
 */

export class PlanLimitError extends Error {
  readonly status = 403;
  readonly limit: number;
  readonly used: number;
  constructor(message: string, used: number, limit: number) {
    super(message);
    this.name = 'PlanLimitError';
    this.used = used;
    this.limit = limit;
  }
}

/** Products counted against the plan: everything except ARCHIVED. */
async function countPlanProducts(supplierId: string): Promise<number> {
  return prisma.product.count({
    where: { supplierId, status: { not: ProductStatus.ARCHIVED } }
  });
}

/** Employees counted against the plan: active members excluding the OWNER. */
async function countPlanEmployees(supplierId: string): Promise<number> {
  return prisma.supplierMember.count({
    where: {
      supplierId,
      isActive: true,
      role: { not: SupplierMemberRole.OWNER }
    }
  });
}

export async function assertCanCreateProduct(supplierId: string): Promise<void> {
  const subscription = await getActiveSubscription(supplierId);
  const limit = subscription.plan.maxProducts;
  if (limit === null) return;
  const used = await countPlanProducts(supplierId);
  if (!isWithinLimit(used, limit)) {
    throw new PlanLimitError(
      `Your ${subscription.plan.code} plan allows up to ${limit} products. Archive a product or upgrade your plan.`,
      used,
      limit
    );
  }
}

export async function assertCanInviteMember(supplierId: string): Promise<void> {
  const subscription = await getActiveSubscription(supplierId);
  const limit = subscription.plan.maxEmployees;
  if (limit === null) return;
  const used = await countPlanEmployees(supplierId);
  if (!isWithinLimit(used, limit)) {
    throw new PlanLimitError(
      `Your ${subscription.plan.code} plan allows up to ${limit} team members. Upgrade your plan to add more.`,
      used,
      limit
    );
  }
}

export type UsageSummary = {
  products: { used: number; limit: number | null };
  employees: { used: number; limit: number | null };
  maxImagesPerProduct: number | null;
};

/** Usage meters for the supplier subscription page. */
export async function getUsageSummary(supplierId: string): Promise<UsageSummary> {
  const subscription = await getActiveSubscription(supplierId);
  const [products, employees] = await Promise.all([
    countPlanProducts(supplierId),
    countPlanEmployees(supplierId)
  ]);
  return {
    products: { used: products, limit: subscription.plan.maxProducts },
    employees: { used: employees, limit: subscription.plan.maxEmployees },
    maxImagesPerProduct: subscription.plan.maxImagesPerProduct
  };
}
