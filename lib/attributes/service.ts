import 'server-only';

import type { AttributeDefinition } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/* ────────────────────────────────────────────────────────────────────────── *
 * Type system
 *
 * `select`  → discrete multi-select chips (e.g. Size = S/M/L)
 * `number`  → range slider (e.g. Weight = 0.5–2 kg)
 * `boolean` → single toggle (e.g. Waterproof = true)
 * `color`   → swatch multi-select (hex | color-name values)
 *
 * NOTE: the DB stores `type` as `String` (not an enum) to keep migrations
 * lightweight. Runtime validation via `ATTRIBUTE_TYPES` is the single source
 * of truth — always use `isAttributeType()` on untrusted input.
 * ────────────────────────────────────────────────────────────────────────── */

export const ATTRIBUTE_TYPES = ['select', 'number', 'boolean', 'color'] as const;
export type AttributeType = typeof ATTRIBUTE_TYPES[number];

export function isAttributeType(v: unknown): v is AttributeType {
  return typeof v === 'string' && (ATTRIBUTE_TYPES as readonly string[]).includes(v);
}

/** Types that carry a list of allowed option values. */
const OPTION_BEARING: readonly AttributeType[] = ['select', 'color'];
export function needsOptions(type: AttributeType): boolean {
  return OPTION_BEARING.includes(type);
}

export type AttributeDefinitionDTO = {
  id: string;
  name: string;
  slug: string;
  type: AttributeType;
  unit: string | null;
  options: string[] | null;
  sortOrder: number;
  nameTranslations: Record<string, string> | null;
  group: string | null;
  categoryCount: number;
};

export type CreateAttributeInput = {
  name: string;
  slug: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  nameTranslations?: Record<string, string>;
  group?: string;
};

export type UpdateAttributeInput = Partial<CreateAttributeInput> & { sortOrder?: number };

/* ─── Row → DTO mapper (single source of truth) ──────────────────────────── */

type RawAttr = AttributeDefinition & { _count?: { categoryAttributes: number } };

function rowToDto(r: RawAttr, categoryCount?: number): AttributeDefinitionDTO {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    type: (isAttributeType(r.type) ? r.type : 'select'),
    unit: r.unit,
    options: Array.isArray(r.options) ? (r.options as string[]) : null,
    sortOrder: r.sortOrder,
    nameTranslations:
      r.nameTranslations && typeof r.nameTranslations === 'object' && !Array.isArray(r.nameTranslations)
        ? (r.nameTranslations as Record<string, string>)
        : null,
    group: r.group,
    categoryCount: categoryCount ?? r._count?.categoryAttributes ?? 0,
  };
}

/* ─── CRUD ──────────────────────────────────────────────────────────────── */

export async function listAttributes(): Promise<AttributeDefinitionDTO[]> {
  const rows = await prisma.attributeDefinition.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { categoryAttributes: true } } },
  });
  return rows.map((r) => rowToDto(r));
}

export async function getAttribute(id: string): Promise<AttributeDefinitionDTO | null> {
  const r = await prisma.attributeDefinition.findUnique({
    where: { id },
    include: { _count: { select: { categoryAttributes: true } } },
  });
  return r ? rowToDto(r) : null;
}

export async function createAttribute(data: CreateAttributeInput): Promise<AttributeDefinitionDTO> {
  const optsInput = needsOptions(data.type) ? ((data.options ?? []) as Prisma.InputJsonValue) : undefined;
  const r = await prisma.attributeDefinition.create({
    data: {
      name: data.name,
      slug: data.slug,
      type: data.type,
      unit: data.unit ?? null,
      ...(optsInput !== undefined && { options: optsInput }),
      ...(data.nameTranslations && { nameTranslations: data.nameTranslations as Prisma.InputJsonValue }),
      group: data.group ?? null,
    },
  });
  return rowToDto(r, 0);
}

export async function updateAttribute(
  id: string,
  data: UpdateAttributeInput
): Promise<AttributeDefinitionDTO> {
  const patch: Prisma.AttributeDefinitionUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.type !== undefined) patch.type = data.type;
  if (data.unit !== undefined) patch.unit = data.unit || null;
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
  if (data.group !== undefined) patch.group = data.group || null;
  if (data.nameTranslations !== undefined) {
    patch.nameTranslations = data.nameTranslations as Prisma.InputJsonValue;
  }
  if (data.options !== undefined) {
    // When the attribute doesn't carry options we null the column so stale
    // values from a previous `select` incarnation are wiped.
    let typeForOpts: AttributeType;
    if (data.type !== undefined) {
      typeForOpts = data.type;
    } else {
      const existing = await prisma.attributeDefinition.findUnique({
        where: { id },
        select: { type: true },
      });
      typeForOpts = isAttributeType(existing?.type) ? existing!.type : 'select';
    }
    patch.options = needsOptions(typeForOpts)
      ? (data.options as Prisma.InputJsonValue)
      : (Prisma.JsonNull as unknown as Prisma.InputJsonValue);
  }

  const r = await prisma.attributeDefinition.update({
    where: { id },
    data: patch,
    include: { _count: { select: { categoryAttributes: true } } },
  });
  return rowToDto(r);
}

export async function deleteAttribute(id: string): Promise<void> {
  await prisma.attributeDefinition.delete({ where: { id } });
}

/**
 * Bulk-reorder attributes in a single transaction. Accepts an array of
 * `{ id, sortOrder }` pairs — order on the client is authoritative.
 */
export async function reorderAttributes(orders: Array<{ id: string; sortOrder: number }>): Promise<void> {
  if (orders.length === 0) return;
  await prisma.$transaction(
    orders.map((o) =>
      prisma.attributeDefinition.update({
        where: { id: o.id },
        data: { sortOrder: o.sortOrder },
      })
    )
  );
}

/* ─── Category-attribute linking ─────────────────────────────────────────── */

export type CategoryAttributeDTO = {
  id: string;
  attributeId: string;
  name: string;
  slug: string;
  type: AttributeType;
  unit: string | null;
  options: string[] | null;
  isFilterable: boolean;
  displayOrder: number;
  nameTranslations: Record<string, string> | null;
};

export async function getCategoryAttributes(
  categoryId: string
): Promise<CategoryAttributeDTO[]> {
  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: { displayOrder: 'asc' },
    include: { attribute: true },
  });
  return rows.map((r) => ({
    id: r.id,
    attributeId: r.attributeId,
    name: r.attribute.name,
    slug: r.attribute.slug,
    type: (isAttributeType(r.attribute.type) ? r.attribute.type : 'select'),
    unit: r.attribute.unit,
    options: Array.isArray(r.attribute.options) ? (r.attribute.options as string[]) : null,
    isFilterable: r.isFilterable,
    displayOrder: r.displayOrder,
    nameTranslations:
      r.attribute.nameTranslations && typeof r.attribute.nameTranslations === 'object' && !Array.isArray(r.attribute.nameTranslations)
        ? (r.attribute.nameTranslations as Record<string, string>)
        : null,
  }));
}

export async function assignAttributeToCategory(
  categoryId: string,
  attributeId: string,
  isFilterable = true
): Promise<void> {
  const maxOrder = await prisma.categoryAttribute.aggregate({
    where: { categoryId },
    _max: { displayOrder: true },
  });
  await prisma.categoryAttribute.upsert({
    where: { categoryId_attributeId: { categoryId, attributeId } },
    create: {
      categoryId,
      attributeId,
      isFilterable,
      displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
    },
    update: { isFilterable },
  });
}

export async function removeAttributeFromCategory(
  categoryId: string,
  attributeId: string
): Promise<void> {
  await prisma.categoryAttribute.deleteMany({
    where: { categoryId, attributeId },
  });
}

export async function updateCategoryAttributeOrder(
  id: string,
  displayOrder: number
): Promise<void> {
  await prisma.categoryAttribute.update({ where: { id }, data: { displayOrder } });
}

/* ─── Per-category filter config ─────────────────────────────────────────── */

export type CategoryFilterConfigDTO = {
  showPriceFilter: boolean | null;
  showBrandFilter: boolean | null;
  showSupplierFilter: boolean | null;
  showInStockFilter: boolean | null;
  showB2BFilter: boolean | null;
  showRatingFilter: boolean | null;
  showDiscountFilter: boolean | null;
  showNewArrivalsFilter: boolean | null;
  showSearchFilter: boolean | null;
};

export async function getCategoryFilterConfig(
  categoryId: string
): Promise<CategoryFilterConfigDTO> {
  const row = await prisma.categoryFilterConfig.findUnique({ where: { categoryId } });
  return {
    showPriceFilter: row?.showPriceFilter ?? null,
    showBrandFilter: row?.showBrandFilter ?? null,
    showSupplierFilter: row?.showSupplierFilter ?? null,
    showInStockFilter: row?.showInStockFilter ?? null,
    showB2BFilter: row?.showB2BFilter ?? null,
    showRatingFilter: row?.showRatingFilter ?? null,
    showDiscountFilter: row?.showDiscountFilter ?? null,
    showNewArrivalsFilter: row?.showNewArrivalsFilter ?? null,
    showSearchFilter: row?.showSearchFilter ?? null,
  };
}

export async function upsertCategoryFilterConfig(
  categoryId: string,
  data: CategoryFilterConfigDTO
): Promise<void> {
  await prisma.categoryFilterConfig.upsert({
    where: { categoryId },
    create: { categoryId, ...data, updatedAt: new Date() },
    update: { ...data, updatedAt: new Date() },
  });
}

/* ─── Product attribute values ───────────────────────────────────────────── */

export async function getProductAttributeValues(
  productId: string
): Promise<Record<string, string>> {
  const rows = await prisma.productAttributeValue.findMany({
    where: { productId },
    include: { attribute: { select: { slug: true } } },
  });
  return Object.fromEntries(rows.map((r) => [r.attribute.slug, r.value]));
}

export async function setProductAttributeValues(
  productId: string,
  values: Record<string, string>
): Promise<void> {
  const slugs = Object.keys(values).filter((s) => values[s].trim() !== '');
  if (slugs.length === 0 && Object.keys(values).length === 0) return;

  const attrs = await prisma.attributeDefinition.findMany({
    where: { slug: { in: Object.keys(values) } },
    select: { id: true, slug: true },
  });
  const slugToId = Object.fromEntries(attrs.map((a) => [a.slug, a.id]));

  await prisma.$transaction([
    prisma.productAttributeValue.deleteMany({ where: { productId } }),
    ...slugs
      .filter((slug) => slugToId[slug])
      .map((slug) =>
        prisma.productAttributeValue.create({
          data: { productId, attributeId: slugToId[slug], value: values[slug].trim() },
        })
      ),
  ]);
}
