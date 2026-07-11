import { cache } from 'react';

import { prisma } from '@/lib/prisma';

/**
 * Header service — single read/write surface for the admin "Header"
 * settings page and for the public `<Header>` server components.
 *
 * Read paths (`getHeaderSettings`, `listNavigationItems`,
 * `listMegaMenuItems`) are wrapped in `react.cache()` so the layered
 * header (TopBar + MainHeader + NavBar) only hits the DB once per
 * request, even though three separate components consume the data.
 *
 * Every read function returns a *DTO* — never a raw Prisma row — so
 * downstream callers don't accidentally start using fields that may
 * later be removed/renamed in the schema.
 */

export const HEADER_SETTINGS_ID = 'singleton';

export type HeaderSettingsDTO = {
  logoUrl: string | null;
  logoText: string;
  phoneNumber: string;
  topbarText: string;
  showTopBar: boolean;
  showSearch: boolean;
  ctaLabel: string;
  ctaHref: string;
};

const DEFAULT_SETTINGS: HeaderSettingsDTO = {
  logoUrl: null,
  logoText: 'DubaiPro',
  phoneNumber: '',
  topbarText: 'Shipping from Dubai',
  showTopBar: true,
  showSearch: true,
  // B2B marketplace CTA — the RFQ-era "Request quote" flow was retired;
  // buyers now negotiate directly with suppliers.
  ctaLabel: 'Find suppliers',
  ctaHref: '/suppliers'
};

export type NavigationItemType = 'CUSTOM' | 'PAGE';

export type NavigationItemDTO = {
  id: string;
  label: string;
  /**
   * Resolved href. For `type=PAGE` this is `/<page.slug>` (kept in
   * sync by the page service on rename). For `type=CUSTOM` it's the
   * raw value the admin typed.
   */
  href: string;
  type: NavigationItemType;
  pageId: string | null;
  /** Slug of the linked page, when `type=PAGE`. Used by clients that
   * want to re-resolve the href without an extra fetch. */
  pageSlug: string | null;
  order: number;
  isActive: boolean;
};

export type MegaMenuItemDTO = {
  id: string;
  categoryId: string;
  /** Effective label = override title ?? category.name. */
  title: string;
  /** Always present so the storefront can build a category URL. */
  categorySlug: string;
  image: string | null;
  order: number;
  isActive: boolean;
};

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export const getHeaderSettings = cache(
  async (): Promise<HeaderSettingsDTO> => {
    const row = await prisma.headerSettings
      .findUnique({ where: { id: HEADER_SETTINGS_ID } })
      .catch(() => null);
    if (!row) return DEFAULT_SETTINGS;
    return {
      logoUrl: row.logoUrl,
      logoText: row.logoText,
      phoneNumber: row.phoneNumber,
      topbarText: row.topbarText,
      showTopBar: row.showTopBar,
      showSearch: row.showSearch,
      ctaLabel: row.ctaLabel,
      ctaHref: row.ctaHref
    };
  }
);

export async function updateHeaderSettings(
  input: Partial<HeaderSettingsDTO>
): Promise<HeaderSettingsDTO> {
  // Strip any non-string / non-boolean values so the typed update can't
  // be poisoned by a bad client payload.
  const data: Record<string, unknown> = {};
  if (input.logoUrl !== undefined)
    data.logoUrl = input.logoUrl ? String(input.logoUrl).slice(0, 2048) : null;
  if (input.logoText !== undefined)
    data.logoText = String(input.logoText).trim().slice(0, 64) || 'DubaiPro';
  if (input.phoneNumber !== undefined)
    data.phoneNumber = String(input.phoneNumber).slice(0, 32);
  if (input.topbarText !== undefined)
    data.topbarText = String(input.topbarText).slice(0, 200);
  if (typeof input.showTopBar === 'boolean') data.showTopBar = input.showTopBar;
  if (typeof input.showSearch === 'boolean') data.showSearch = input.showSearch;
  if (input.ctaLabel !== undefined)
    data.ctaLabel = String(input.ctaLabel).slice(0, 64);
  if (input.ctaHref !== undefined)
    data.ctaHref = String(input.ctaHref).slice(0, 512);

  const row = await prisma.headerSettings.upsert({
    where: { id: HEADER_SETTINGS_ID },
    update: data,
    create: { id: HEADER_SETTINGS_ID, ...data }
  });

  return {
    logoUrl: row.logoUrl,
    logoText: row.logoText,
    phoneNumber: row.phoneNumber,
    topbarText: row.topbarText,
    showTopBar: row.showTopBar,
    showSearch: row.showSearch,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref
  };
}

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

type NavRow = {
  id: string;
  label: string;
  href: string;
  type: NavigationItemType;
  pageId: string | null;
  order: number;
  isActive: boolean;
  page: { slug: string; isActive: boolean } | null;
};

function navRowToDTO(r: NavRow): NavigationItemDTO {
  // For PAGE-typed rows we re-derive the href from the linked page's
  // slug — this is the source of truth, so even if the cached `href`
  // column drifts (e.g. partial migration) the public site stays
  // correct.
  const href =
    r.type === 'PAGE' && r.page?.slug
      ? `/${r.page.slug}`
      : r.href;
  return {
    id: r.id,
    label: r.label,
    href,
    type: r.type,
    pageId: r.pageId,
    pageSlug: r.page?.slug ?? null,
    order: r.order,
    isActive: r.isActive
  };
}

export const listNavigationItems = cache(
  async (opts: { activeOnly?: boolean } = {}): Promise<NavigationItemDTO[]> => {
    const rows = await prisma.navigationItem
      .findMany({
        where: opts.activeOnly
          ? {
              isActive: true,
              // Hide PAGE-typed nav items whose linked page was
              // deleted or deactivated — otherwise we'd render dead
              // links to nowhere.
              OR: [
                { type: 'CUSTOM' },
                { type: 'PAGE', page: { isActive: true } }
              ]
            }
          : undefined,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: { page: { select: { slug: true, isActive: true } } }
      })
      .catch(() => [] as NavRow[]);
    return (rows as NavRow[]).map(navRowToDTO);
  }
);

/**
 * Resolve a `pageId` to its slug, or null if unknown / inactive. Used
 * to keep `NavigationItem.href` in sync with the linked page so
 * client navigation doesn't need an extra round-trip.
 */
async function pageSlugFor(pageId: string): Promise<string | null> {
  const p = await prisma.page
    .findUnique({ where: { id: pageId }, select: { slug: true } })
    .catch(() => null);
  return p?.slug ?? null;
}

export async function createNavigationItem(input: {
  label: string;
  href?: string;
  type?: NavigationItemType;
  pageId?: string | null;
  order?: number;
  isActive?: boolean;
}): Promise<NavigationItemDTO> {
  const type: NavigationItemType = input.type ?? 'CUSTOM';

  // Default `order` to "after the last existing item" so admins don't
  // need to pick a number.
  const last = await prisma.navigationItem.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true }
  });
  const order = input.order ?? (last ? last.order + 1 : 0);

  let href = (input.href ?? '').trim();
  let pageId: string | null = null;

  if (type === 'PAGE') {
    if (!input.pageId) throw new Error('pageId_required');
    const slug = await pageSlugFor(input.pageId);
    if (!slug) throw new Error('page_not_found');
    pageId = input.pageId;
    href = `/${slug}`;
  } else {
    if (!href) throw new Error('href_required');
  }

  const row = await prisma.navigationItem.create({
    data: {
      label: input.label.trim().slice(0, 64),
      href: href.slice(0, 512),
      type,
      pageId,
      order,
      isActive: input.isActive ?? true
    },
    include: { page: { select: { slug: true, isActive: true } } }
  });
  return navRowToDTO(row as NavRow);
}

export async function updateNavigationItem(
  id: string,
  input: Partial<{
    label: string;
    href: string;
    type: NavigationItemType;
    pageId: string | null;
    order: number;
    isActive: boolean;
  }>
): Promise<NavigationItemDTO> {
  // Read the current row so we can validate transitions (CUSTOM<->PAGE)
  // and keep `href` in sync with the linked page's slug.
  const current = await prisma.navigationItem.findUnique({
    where: { id },
    select: { type: true, pageId: true, href: true }
  });
  if (!current) throw new Error('not_found');

  const nextType: NavigationItemType = input.type ?? current.type;
  const data: Record<string, unknown> = {};

  if (input.label !== undefined) data.label = input.label.trim().slice(0, 64);
  if (typeof input.order === 'number' && Number.isFinite(input.order))
    data.order = Math.max(0, Math.floor(input.order));
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

  if (nextType === 'PAGE') {
    const pageId = input.pageId ?? current.pageId;
    if (!pageId) throw new Error('pageId_required');
    const slug = await pageSlugFor(pageId);
    if (!slug) throw new Error('page_not_found');
    data.type = 'PAGE';
    data.pageId = pageId;
    data.href = `/${slug}`;
  } else {
    // CUSTOM — drop the FK and use the explicit href (or keep current).
    data.type = 'CUSTOM';
    data.pageId = null;
    const nextHref = (input.href ?? current.href).trim();
    if (!nextHref) throw new Error('href_required');
    data.href = nextHref.slice(0, 512);
  }

  const row = await prisma.navigationItem.update({
    where: { id },
    data,
    include: { page: { select: { slug: true, isActive: true } } }
  });
  return navRowToDTO(row as NavRow);
}

export async function deleteNavigationItem(id: string): Promise<void> {
  await prisma.navigationItem.delete({ where: { id } });
}

/**
 * Atomically rewrite the order of every item from an explicit id list.
 * Items not in the list are left alone.
 */
export async function reorderNavigationItems(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.navigationItem.update({
        where: { id },
        data: { order: idx }
      })
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Mega menu                                                                  */
/* -------------------------------------------------------------------------- */

export const listMegaMenuItems = cache(
  async (opts: { activeOnly?: boolean } = {}): Promise<MegaMenuItemDTO[]> => {
    const rows = await prisma.megaMenuItem
      .findMany({
        where: opts.activeOnly ? { isActive: true } : undefined,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: { category: { select: { name: true, slug: true } } }
      })
      .catch(() => []);
    return rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      title: r.title?.trim() || r.category.name,
      categorySlug: r.category.slug,
      image: r.image,
      order: r.order,
      isActive: r.isActive
    }));
  }
);

export async function addMegaMenuItem(input: {
  categoryId: string;
  title?: string | null;
  image?: string | null;
}): Promise<MegaMenuItemDTO> {
  const last = await prisma.megaMenuItem.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true }
  });
  const order = last ? last.order + 1 : 0;

  const row = await prisma.megaMenuItem.create({
    data: {
      categoryId: input.categoryId,
      title: input.title?.trim() || null,
      image: input.image?.trim() || null,
      order,
      isActive: true
    },
    include: { category: { select: { name: true, slug: true } } }
  });
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title?.trim() || row.category.name,
    categorySlug: row.category.slug,
    image: row.image,
    order: row.order,
    isActive: row.isActive
  };
}

export async function updateMegaMenuItem(
  id: string,
  input: Partial<{ title: string | null; image: string | null; isActive: boolean }>
): Promise<MegaMenuItemDTO> {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined)
    data.title = input.title ? String(input.title).trim().slice(0, 64) : null;
  if (input.image !== undefined)
    data.image = input.image ? String(input.image).trim().slice(0, 2048) : null;
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;

  const row = await prisma.megaMenuItem.update({
    where: { id },
    data,
    include: { category: { select: { name: true, slug: true } } }
  });
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title?.trim() || row.category.name,
    categorySlug: row.category.slug,
    image: row.image,
    order: row.order,
    isActive: row.isActive
  };
}

export async function removeMegaMenuItem(id: string): Promise<void> {
  await prisma.megaMenuItem.delete({ where: { id } });
}

export async function reorderMegaMenuItems(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.megaMenuItem.update({ where: { id }, data: { order: idx } })
    )
  );
}

