import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

import type { HomepageSectionDTO } from './types';
import type { HomepageSectionType, Prisma } from '@prisma/client';

/**
 * Homepage service — single read/write surface for the public
 * `<SectionRenderer>` and the admin `/admin/homepage` manager.
 *
 *  - Reads (`listSections`, `listActiveSections`) are wrapped in
 *    `react.cache()` so the storefront homepage can call them from
 *    multiple sub-components (eg. metadata + page body) and still
 *    only hit the DB once per request.
 *  - Writes invalidate by simply calling `prisma` mutations and
 *    relying on the consumer to `router.refresh()` afterwards.
 *  - Every read returns a *DTO* so downstream callers never depend
 *    on raw Prisma row shape (config Json, nullable fields, etc).
 */

const SECTION_TYPES = [
  'HERO',
  'CATEGORIES',
  'FEATURED_PRODUCTS',
  'TRUST',
  'BECOME_SUPPLIER',
  'GLOBAL_SHOPPING',
  'TOP_SUPPLIERS',
  'AUCTION',
  'BLOG'
] as const satisfies readonly HomepageSectionType[];

export type CreateSectionInput = {
  type: HomepageSectionType;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  ctaSecondaryLabel?: string | null;
  ctaSecondaryHref?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  config?: Record<string, unknown> | null;
  isActive?: boolean;
};

export type UpdateSectionInput = Partial<CreateSectionInput>;

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/** Every section, ordered by `order` asc — used by admin. */
export const listSections = cache(async (): Promise<HomepageSectionDTO[]> => {
  const rows = await prisma.homepageSection
    .findMany({ orderBy: { order: 'asc' } })
    .catch(() => []);
  return rows.map(toDTO);
});

/** Active sections only — used by the public storefront. Defaults are
 *  seeded lazily here so a freshly-deployed instance with an empty
 *  table still renders a fully-populated homepage. */
export const listActiveSections = cache(
  async (): Promise<HomepageSectionDTO[]> => {
    const rows = await prisma.homepageSection
      .findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      })
      .catch(() => []);
    if (rows.length > 0) return rows.map(toDTO);

    // Empty table → seed defaults synchronously, then re-read.
    await ensureDefaults().catch(() => {
      /* If seeding fails (eg. read-only DB) we fall back to defaults
       * without persisting — storefront still renders. */
    });
    const seeded = await prisma.homepageSection
      .findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      })
      .catch(() => []);
    if (seeded.length > 0) return seeded.map(toDTO);

    // Last-resort in-memory defaults — every nullable column is
    // explicitly set so the shape matches HomepageSectionDTO.
    return DEFAULTS.map((d, i) => ({
      id: `default-${i}`,
      type: d.type,
      title: d.title,
      subtitle: d.subtitle ?? null,
      ctaLabel: d.ctaLabel ?? null,
      ctaHref: d.ctaHref ?? null,
      ctaSecondaryLabel: d.ctaSecondaryLabel ?? null,
      ctaSecondaryHref: d.ctaSecondaryHref ?? null,
      badge: d.badge ?? null,
      imageUrl: d.imageUrl ?? null,
      config: (d.config ?? {}) as Record<string, unknown>,
      isActive: true,
      order: i
    }));
  }
);

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createSection(
  input: CreateSectionInput
): Promise<HomepageSectionDTO> {
  // Find the largest `order` so new rows append at the end.
  const last = await prisma.homepageSection
    .findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    .catch(() => null);
  const nextOrder = (last?.order ?? -1) + 1;

  const row = await prisma.homepageSection.create({
    data: {
      type: input.type,
      title: input.title.trim().slice(0, 200),
      subtitle: trimOrNull(input.subtitle, 1000),
      ctaLabel: trimOrNull(input.ctaLabel, 100),
      ctaHref: trimOrNull(input.ctaHref, 500),
      ctaSecondaryLabel: trimOrNull(input.ctaSecondaryLabel, 100),
      ctaSecondaryHref: trimOrNull(input.ctaSecondaryHref, 500),
      badge: trimOrNull(input.badge, 100),
      imageUrl: trimOrNull(input.imageUrl, 2048),
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
      order: nextOrder
    }
  });
  return toDTO(row);
}

export async function updateSection(
  id: string,
  input: UpdateSectionInput
): Promise<HomepageSectionDTO> {
  const data: Prisma.HomepageSectionUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.subtitle !== undefined)
    data.subtitle = trimOrNull(input.subtitle, 1000);
  if (input.ctaLabel !== undefined)
    data.ctaLabel = trimOrNull(input.ctaLabel, 100);
  if (input.ctaHref !== undefined)
    data.ctaHref = trimOrNull(input.ctaHref, 500);
  if (input.ctaSecondaryLabel !== undefined)
    data.ctaSecondaryLabel = trimOrNull(input.ctaSecondaryLabel, 100);
  if (input.ctaSecondaryHref !== undefined)
    data.ctaSecondaryHref = trimOrNull(input.ctaSecondaryHref, 500);
  if (input.badge !== undefined) data.badge = trimOrNull(input.badge, 100);
  if (input.imageUrl !== undefined)
    data.imageUrl = trimOrNull(input.imageUrl, 2048);
  if (input.config !== undefined)
    data.config = (input.config ?? {}) as Prisma.InputJsonValue;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const row = await prisma.homepageSection.update({ where: { id }, data });
  return toDTO(row);
}

export async function toggleSection(
  id: string,
  active: boolean
): Promise<HomepageSectionDTO> {
  const row = await prisma.homepageSection.update({
    where: { id },
    data: { isActive: active }
  });
  return toDTO(row);
}

export async function deleteSection(id: string): Promise<void> {
  await prisma.homepageSection.delete({ where: { id } });
}

/**
 * Reorder sections by an explicit list of ids. Anything not in `ids`
 * keeps its current order, but in practice the admin UI sends the
 * full list so this is effectively a total ordering update.
 *
 * Done in a single transaction so the table never sees a partial
 * order during the swap.
 */
export async function reorderSections(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.homepageSection.update({ where: { id }, data: { order: index } })
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

/** Seeded the first time `listActiveSections` is called against an
 *  empty table. The `count > 0` short-circuit makes re-running safe
 *  even though `type` is no longer unique — duplicate sections are an
 *  intentional admin feature, so we never write defaults on top of an
 *  existing row. */
export async function ensureDefaults(): Promise<void> {
  const existingTypes = await prisma.homepageSection
    .findMany({ select: { type: true } })
    .then((rows) => new Set(rows.map((r) => r.type)));

  // Fresh install → seed everything.
  if (existingTypes.size === 0) {
    await prisma.$transaction(
      DEFAULTS.map((d, i) =>
        prisma.homepageSection.create({
          data: {
            ...d,
            order: i,
            isActive: true,
            config: (d.config ?? {}) as Prisma.InputJsonValue
          }
        })
      )
    );
    return;
  }

  // Existing install → only insert types that are completely missing
  // (never overwrite something the admin may have customised).
  const maxOrder = await prisma.homepageSection
    .findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    .then((r) => r?.order ?? -1);

  const missing = DEFAULTS.filter((d) => !existingTypes.has(d.type));
  if (missing.length === 0) return;

  await prisma.$transaction(
    missing.map((d, i) =>
      prisma.homepageSection.create({
        data: {
          ...d,
          order: maxOrder + 1 + i,
          isActive: false,
          config: (d.config ?? {}) as Prisma.InputJsonValue
        }
      })
    )
  );
}

/** Default content for a fresh install. Mirrors the i18n keys under
 *  `home.sections.*` so storefront translations stay in charge of the
 *  copy until an admin overrides it from the panel. */
const DEFAULTS: ReadonlyArray<
  Omit<CreateSectionInput, 'isActive'> & { order?: number }
> = [
  {
    type: 'HERO',
    title: 'Buy from Dubai. Delivered worldwide.',
    subtitle:
      'Source products from global brands, suppliers, and wholesale markets in UAE. Ship to Iran and worldwide.',
    badge: 'Direct from UAE suppliers',
    ctaLabel: 'Browse Products',
    ctaHref: '/products',
    ctaSecondaryLabel: 'Start Wholesale Buying',
    ctaSecondaryHref: '/contact?type=quote',
    config: {
      chips: ['Verified suppliers', 'Fast shipping', 'Secure payments']
    }
  },
  {
    type: 'CATEGORIES',
    title: 'Shop by category',
    subtitle: 'Explore our most-popular departments.',
    ctaLabel: 'View all',
    ctaHref: '/categories',
    config: { limit: 8 }
  },
  {
    type: 'FEATURED_PRODUCTS',
    title: 'Featured products',
    subtitle: 'Hand-picked items from verified UAE suppliers.',
    ctaLabel: 'See all products',
    ctaHref: '/products',
    config: { limit: 8 }
  },
  {
    type: 'TRUST',
    title: 'Why DubaiPro',
    subtitle: 'Five reasons buyers in 80+ countries choose us.',
    config: {
      items: [
        {
          title: 'Verified suppliers',
          description: 'Every supplier is vetted before going live.',
          icon: 'shield'
        },
        {
          title: 'Secure payments',
          description: 'Card, bank transfer, and crypto — escrow on demand.',
          icon: 'lock'
        },
        {
          title: 'Fast shipping from Dubai',
          description: 'Air & sea routes to 80+ countries.',
          icon: 'truck'
        },
        {
          title: 'Bulk discounts',
          description: 'Tiered pricing on wholesale orders.',
          icon: 'tag'
        },
        {
          title: 'Delivery to Iran & worldwide',
          description: 'Customs, taxes, and last-mile handled end-to-end.',
          icon: 'globe'
        }
      ]
    }
  },
  {
    type: 'BECOME_SUPPLIER',
    title: 'Sell your products globally',
    subtitle:
      'List on DubaiPro and reach buyers in Iran, the GCC, and worldwide. We handle logistics from Dubai.',
    ctaLabel: 'Register as supplier',
    ctaHref: '/supplier',
    config: {
      benefits: [
        'Access global buyers',
        'Easy listing in minutes',
        'UAE-based logistics'
      ]
    }
  },
  {
    type: 'GLOBAL_SHOPPING',
    title: 'Shop the world from Dubai',
    subtitle:
      'We source from every major UAE platform and wholesale market — you place one order, we handle the rest.',
    config: {
      cards: [
        {
          title: 'Amazon UAE',
          description: 'Order any item, we receive and forward it.',
          ctaLabel: 'Start order',
          ctaHref: '/contact?type=quote&channel=amazon',
          icon: 'cart',
          accent: 'orange'
        },
        {
          title: 'Noon · Shein',
          description: 'Trending fashion and electronics, delivered.',
          ctaLabel: 'Start order',
          ctaHref: '/contact?type=quote&channel=noon',
          icon: 'sparkle',
          accent: 'rose'
        },
        {
          title: 'Alibaba wholesale',
          description: 'Bulk orders with verified factory matching.',
          ctaLabel: 'Start order',
          ctaHref: '/contact?type=quote&channel=alibaba',
          icon: 'warehouse',
          accent: 'sky'
        },
        {
          title: 'Direct Dubai markets',
          description: 'Dragon Mart, Deira, gold souks — buy in person.',
          ctaLabel: 'Start order',
          ctaHref: '/contact?type=quote&channel=dubai',
          icon: 'building',
          accent: 'amber'
        }
      ]
    }
  },
  {
    type: 'TOP_SUPPLIERS',
    title: 'Top suppliers',
    subtitle:
      'Verified UAE suppliers with strong track records. Click through to browse their full catalog.',
    ctaLabel: 'View all suppliers',
    ctaHref: '/suppliers',
    config: { limit: 6 }
  },
  {
    type: 'AUCTION',
    title: 'Live UAE auctions',
    subtitle:
      'Bid on overstock and end-of-line lots from Dubai warehouses. New batches every Friday.',
    ctaLabel: 'View all auctions',
    ctaHref: '/auctions',
    config: {
      items: []
    }
  },
  {
    type: 'BLOG',
    title: 'Buyer guides',
    subtitle:
      'How to import, ship, and clear customs from Dubai — written by our sourcing team.',
    ctaLabel: 'Read the blog',
    ctaHref: '/blog',
    config: { limit: 3 }
  }
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function trimOrNull(value: string | null | undefined, max: number) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function toDTO(row: {
  id: string;
  type: HomepageSectionType;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
  badge: string | null;
  imageUrl: string | null;
  config: unknown;
  isActive: boolean;
  order: number;
}): HomepageSectionDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    ctaSecondaryLabel: row.ctaSecondaryLabel,
    ctaSecondaryHref: row.ctaSecondaryHref,
    badge: row.badge,
    imageUrl: row.imageUrl,
    config:
      row.config && typeof row.config === 'object' && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {},
    isActive: row.isActive,
    order: row.order
  };
}

export const HOMEPAGE_SECTION_TYPES = SECTION_TYPES;
