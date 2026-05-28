/**
 * MediaUsage helpers.
 *
 * The `MediaUsage` table is a non-authoritative cross-reference: legacy
 * URL columns on Product/Category/Brand/etc. remain the source of truth
 * for rendering. We populate `MediaUsage` whenever an admin attaches an
 * asset so we can answer two operational questions cheaply:
 *
 *   1) "Is this asset safe to delete?" → count rows.
 *   2) "Where is this asset shown?"     → list rows joined to entity.
 *
 * Calls are idempotent: the unique index `(assetId, entityType,
 * entityId, field)` prevents double-tracking.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/** Discriminator literal for `MediaUsage.entityType`. */
export type MediaUsageEntity =
  | 'product'
  | 'category'
  | 'brand'
  | 'page'
  | 'blog'
  | 'hero'
  | 'header'
  | 'megamenu'
  | 'auction'
  | 'review'
  | 'user'
  | 'banner'
  | 'supplier';

export interface UsageInput {
  assetId: string;
  entityType: MediaUsageEntity;
  entityId: string;
  field: string;
}

/** Insert (or no-op) one usage row. Safe to call from any mutation. */
export async function trackMediaUsage(input: UsageInput): Promise<void> {
  try {
    await prisma.mediaUsage.upsert({
      where: {
        assetId_entityType_entityId_field: {
          assetId:    input.assetId,
          entityType: input.entityType,
          entityId:   input.entityId,
          field:      input.field,
        },
      },
      create: {
        assetId:    input.assetId,
        entityType: input.entityType,
        entityId:   input.entityId,
        field:      input.field,
      },
      update: {},
    });
  } catch (error) {
    // Non-fatal — usage tracking is best-effort, never blocks the
    // owning entity write.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.warn(`trackMediaUsage skipped (${error.code}):`, error.message);
    } else {
      console.warn('trackMediaUsage failed:', error);
    }
  }
}

/** Bulk track — used when an entity has multiple image fields. */
export async function trackMediaUsages(rows: UsageInput[]): Promise<void> {
  await Promise.all(rows.map(trackMediaUsage));
}

/** Remove rows for one (entityType, entityId) when the entity is deleted. */
export async function untrackEntityUsage(
  entityType: MediaUsageEntity,
  entityId: string,
): Promise<void> {
  try {
    await prisma.mediaUsage.deleteMany({ where: { entityType, entityId } });
  } catch (error) {
    console.warn('untrackEntityUsage failed:', error);
  }
}

/** Detach one specific (asset, entity, field) reference. */
export async function untrackMediaUsage(input: UsageInput): Promise<void> {
  try {
    await prisma.mediaUsage.deleteMany({
      where: {
        assetId:    input.assetId,
        entityType: input.entityType,
        entityId:   input.entityId,
        field:      input.field,
      },
    });
  } catch (error) {
    console.warn('untrackMediaUsage failed:', error);
  }
}

/** Count usages — used by the gallery delete confirmation. */
export async function countAssetUsage(assetId: string): Promise<number> {
  return prisma.mediaUsage.count({ where: { assetId } });
}

/** Hydrate a usage list with minimal entity titles for UI display. */
export interface UsageRow {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  createdAt: Date;
  /** Best-effort denormalised label (product title, category name, …). */
  label: string | null;
}

export async function listAssetUsage(assetId: string): Promise<UsageRow[]> {
  const rows = await prisma.mediaUsage.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  if (rows.length === 0) return [];

  // Resolve labels per entity type in parallel batches.
  const byType = new Map<string, string[]>();
  for (const r of rows) {
    if (!byType.has(r.entityType)) byType.set(r.entityType, []);
    byType.get(r.entityType)!.push(r.entityId);
  }

  const labelMap = new Map<string, string>(); // `${type}:${id}` → label

  const tasks: Promise<void>[] = [];
  if (byType.has('product')) {
    tasks.push(
      prisma.product
        .findMany({
          where: { id: { in: byType.get('product')! } },
          select: { id: true, title: true },
        })
        .then((items) => {
          for (const it of items) labelMap.set(`product:${it.id}`, it.title);
        }),
    );
  }
  if (byType.has('category')) {
    tasks.push(
      prisma.category
        .findMany({
          where: { id: { in: byType.get('category')! } },
          select: { id: true, name: true },
        })
        .then((items) => {
          for (const it of items) labelMap.set(`category:${it.id}`, it.name);
        }),
    );
  }
  if (byType.has('brand')) {
    tasks.push(
      prisma.brand
        .findMany({
          where: { id: { in: byType.get('brand')! } },
          select: { id: true, name: true },
        })
        .then((items) => {
          for (const it of items) labelMap.set(`brand:${it.id}`, it.name);
        }),
    );
  }
  if (byType.has('blog')) {
    tasks.push(
      prisma.blogPost
        .findMany({
          where: { id: { in: byType.get('blog')! } },
          select: { id: true, title: true },
        })
        .then((items) => {
          for (const it of items) labelMap.set(`blog:${it.id}`, it.title);
        }),
    );
  }
  if (byType.has('page')) {
    tasks.push(
      prisma.page
        .findMany({
          where: { id: { in: byType.get('page')! } },
          select: { id: true, title: true },
        })
        .then((items) => {
          for (const it of items) labelMap.set(`page:${it.id}`, it.title);
        }),
    );
  }

  await Promise.all(tasks);

  return rows.map((r) => ({
    id:         r.id,
    entityType: r.entityType,
    entityId:   r.entityId,
    field:      r.field,
    createdAt:  r.createdAt,
    label:      labelMap.get(`${r.entityType}:${r.entityId}`) ?? null,
  }));
}
