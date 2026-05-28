import { cache } from 'react';
import { Prisma } from '@prisma/client';

import { slugify } from '@/lib/api/validation';
import { prisma } from '@/lib/prisma';
import type {
  PageDTO,
  PageSectionDTO,
  PageSeoDTO,
  PageStatus,
  PageSummaryDTO,
  SectionConfig,
} from './types';

export type {
  PageDTO,
  PageSectionDTO,
  PageSeoDTO,
  PageStatus,
  PageSummaryDTO,
  SectionConfig,
} from './types';

const TITLE_MAX = 120;
const SLUG_MAX = 96;
const META_TITLE_MAX = 160;
const META_DESC_MAX = 320;
const BODY_MAX = 200_000;

/* -------------------------------------------------------------------------- */
/* Row → DTO mappers                                                          */
/* -------------------------------------------------------------------------- */

function sectionToDTO(row: {
  id: string;
  pageId: string;
  type: string;
  order: number;
  config: unknown;
  isVisible: boolean;
}): PageSectionDTO {
  return {
    id: row.id,
    pageId: row.pageId,
    type: row.type as PageSectionDTO['type'],
    order: row.order,
    config: (row.config ?? {}) as SectionConfig,
    isVisible: row.isVisible,
  };
}

function seoToDTO(row: {
  pageId: string;
  ogImage: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  structuredData: unknown;
}): PageSeoDTO {
  return {
    pageId: row.pageId,
    ogImage: row.ogImage,
    canonicalUrl: row.canonicalUrl,
    robots: row.robots,
    structuredData:
      row.structuredData != null
        ? (row.structuredData as Record<string, unknown>)
        : null,
  };
}

function pageToDTO(
  row: {
    id: string;
    title: string;
    slug: string;
    body: string;
    metaTitle: string | null;
    metaDescription: string | null;
    status: string;
    locale: string;
    isActive: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  },
  sections: PageSectionDTO[] = [],
  seo: PageSeoDTO | null = null
): PageDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    status: row.status as PageStatus,
    locale: row.locale,
    isActive: row.isActive,
    order: row.order,
    sections,
    seo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function pageToSummary(row: {
  id: string;
  title: string;
  slug: string;
  status: string;
  locale: string;
  isActive: boolean;
  order: number;
  updatedAt: Date;
  _count: { sections: number };
  seo: { pageId: string } | null;
}): PageSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status as PageStatus,
    locale: row.locale,
    isActive: row.isActive,
    order: row.order,
    sectionCount: row._count.sections,
    hasSeo: row.seo !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Slug helpers                                                                */
/* -------------------------------------------------------------------------- */

function normalizeSlug(raw: string | undefined, title: string): string {
  const candidate = (raw && raw.trim()) || title;
  const slug = slugify(candidate).slice(0, SLUG_MAX);
  return slug || 'page';
}

async function ensureUniqueSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  let slug = base;
  let n = 2;
  while (n < 200) {
    const existing = await prisma.page.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n}`.slice(0, SLUG_MAX);
    n += 1;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, SLUG_MAX);
}

/* -------------------------------------------------------------------------- */
/* Page reads                                                                  */
/* -------------------------------------------------------------------------- */

export const listPages = cache(
  async (opts: {
    activeOnly?: boolean;
    status?: PageStatus;
    locale?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: PageSummaryDTO[]; total: number }> => {
    const where: Record<string, unknown> = {};
    if (opts.activeOnly) where.isActive = true;
    if (opts.status) where.status = opts.status;
    if (opts.locale) where.locale = opts.locale;
    if (opts.search) {
      where.OR = [
        { title: { contains: opts.search, mode: 'insensitive' } },
        { slug: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const limit = opts.limit ?? 50;
    const skip = ((opts.page ?? 1) - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          locale: true,
          isActive: true,
          order: true,
          updatedAt: true,
          _count: { select: { sections: true } },
          seo: { select: { pageId: true } },
        },
      }).catch(() => []),
      prisma.page.count({ where }).catch(() => 0),
    ]);

    return { items: rows.map(pageToSummary), total };
  }
);

export const getPageBySlug = cache(
  async (slug: string): Promise<PageDTO | null> => {
    if (!slug) return null;
    const row = await prisma.page
      .findUnique({
        where: { slug },
        include: {
          sections: { orderBy: { order: 'asc' } },
          seo: true,
        },
      })
      .catch(() => null);

    if (!row || row.status !== 'PUBLISHED') return null;

    return pageToDTO(
      row,
      row.sections.map(sectionToDTO),
      row.seo ? seoToDTO(row.seo) : null
    );
  }
);

export async function getPageById(id: string): Promise<PageDTO | null> {
  const row = await prisma.page
    .findUnique({
      where: { id },
      include: {
        sections: { orderBy: { order: 'asc' } },
        seo: true,
      },
    })
    .catch(() => null);

  if (!row) return null;

  return pageToDTO(
    row,
    row.sections.map(sectionToDTO),
    row.seo ? seoToDTO(row.seo) : null
  );
}

/* -------------------------------------------------------------------------- */
/* Page writes                                                                 */
/* -------------------------------------------------------------------------- */

export type CreatePageInput = {
  title: string;
  slug?: string;
  body?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  status?: PageStatus;
  locale?: string;
};

export async function createPage(input: CreatePageInput): Promise<PageDTO> {
  const title = input.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error('title_required');

  const baseSlug = normalizeSlug(input.slug, title);
  const slug = await ensureUniqueSlug(baseSlug);

  const last = await prisma.page.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = last ? last.order + 1 : 0;
  const status = input.status ?? 'DRAFT';

  const row = await prisma.page.create({
    data: {
      title,
      slug,
      body: (input.body ?? '').slice(0, BODY_MAX),
      metaTitle: input.metaTitle?.trim().slice(0, META_TITLE_MAX) || null,
      metaDescription:
        input.metaDescription?.trim().slice(0, META_DESC_MAX) || null,
      status,
      locale: input.locale ?? '',
      isActive: status === 'PUBLISHED',
      order,
    },
    include: { sections: true, seo: true },
  });

  return pageToDTO(row, [], null);
}

export type UpdatePageInput = Partial<{
  title: string;
  slug: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  status: PageStatus;
  locale: string;
  isActive: boolean;
  order: number;
}>;

export async function updatePage(
  id: string,
  input: UpdatePageInput
): Promise<PageDTO> {
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const t = input.title.trim().slice(0, TITLE_MAX);
    if (!t) throw new Error('title_required');
    data.title = t;
  }
  if (input.slug !== undefined) {
    const base = normalizeSlug(
      input.slug,
      typeof data.title === 'string' ? data.title : 'page'
    );
    data.slug = await ensureUniqueSlug(base, id);
  }
  if (input.body !== undefined)
    data.body = String(input.body).slice(0, BODY_MAX);
  if (input.metaTitle !== undefined)
    data.metaTitle = input.metaTitle?.trim().slice(0, META_TITLE_MAX) || null;
  if (input.metaDescription !== undefined)
    data.metaDescription =
      input.metaDescription?.trim().slice(0, META_DESC_MAX) || null;
  if (input.status !== undefined) {
    data.status = input.status;
    data.isActive = input.status === 'PUBLISHED';
  } else if (typeof input.isActive === 'boolean') {
    data.isActive = input.isActive;
    data.status = input.isActive ? 'PUBLISHED' : 'DRAFT';
  }
  if (input.locale !== undefined) data.locale = input.locale.slice(0, 8);
  if (typeof input.order === 'number' && Number.isFinite(input.order))
    data.order = Math.max(0, Math.floor(input.order));

  const row = await prisma.page.update({
    where: { id },
    data,
    include: {
      sections: { orderBy: { order: 'asc' } },
      seo: true,
    },
  });

  if (typeof data.slug === 'string') {
    await prisma.navigationItem.updateMany({
      where: { pageId: id },
      data: { href: `/${data.slug}` },
    });
  }

  return pageToDTO(
    row,
    row.sections.map(sectionToDTO),
    row.seo ? seoToDTO(row.seo) : null
  );
}

export async function deletePage(id: string): Promise<void> {
  await prisma.page.delete({ where: { id } });
}

export async function reorderPages(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.page.update({ where: { id }, data: { order: idx } })
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Section reads/writes                                                        */
/* -------------------------------------------------------------------------- */

export async function getSectionsByPageId(
  pageId: string
): Promise<PageSectionDTO[]> {
  const rows = await prisma.pageSection
    .findMany({
      where: { pageId },
      orderBy: { order: 'asc' },
    })
    .catch(() => []);
  return rows.map(sectionToDTO);
}

export type CreateSectionInput = {
  type: PageSectionDTO['type'];
  config?: SectionConfig;
  isVisible?: boolean;
};

export async function createSection(
  pageId: string,
  input: CreateSectionInput
): Promise<PageSectionDTO> {
  const last = await prisma.pageSection.findFirst({
    where: { pageId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = last ? last.order + 1 : 0;

  const row = await prisma.pageSection.create({
    data: {
      pageId,
      type: input.type,
      order,
      config: (input.config ?? {}) as object,
      isVisible: input.isVisible ?? true,
    },
  });
  return sectionToDTO(row);
}

export type UpdateSectionInput = Partial<{
  type: PageSectionDTO['type'];
  config: SectionConfig;
  isVisible: boolean;
  order: number;
}>;

export async function updateSection(
  id: string,
  input: UpdateSectionInput
): Promise<PageSectionDTO> {
  const data: Record<string, unknown> = {};
  if (input.type) data.type = input.type;
  if (input.config !== undefined) data.config = input.config as object;
  if (typeof input.isVisible === 'boolean') data.isVisible = input.isVisible;
  if (typeof input.order === 'number') data.order = input.order;

  const row = await prisma.pageSection.update({ where: { id }, data });
  return sectionToDTO(row);
}

export async function deleteSection(id: string): Promise<void> {
  await prisma.pageSection.delete({ where: { id } });
}

export async function reorderSections(
  pageId: string,
  orderedIds: string[]
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.pageSection.update({ where: { id }, data: { order: idx } })
    )
  );
}

/* -------------------------------------------------------------------------- */
/* SEO reads/writes                                                            */
/* -------------------------------------------------------------------------- */

export async function getPageSeo(
  pageId: string
): Promise<PageSeoDTO | null> {
  const row = await prisma.pageSeo
    .findUnique({ where: { pageId } })
    .catch(() => null);
  return row ? seoToDTO(row) : null;
}

export type UpsertSeoInput = {
  ogImage?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
  structuredData?: Record<string, unknown> | null;
};

export async function upsertPageSeo(
  pageId: string,
  input: UpsertSeoInput
): Promise<PageSeoDTO> {
  const data = {
    ogImage: input.ogImage ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    robots: input.robots ?? null,
    structuredData:
      input.structuredData != null
        ? (input.structuredData as Prisma.InputJsonValue)
        : Prisma.JsonNull,
  };
  const row = await prisma.pageSeo.upsert({
    where: { pageId },
    create: { pageId, ...data },
    update: data,
  });
  return seoToDTO(row);
}
