import { cache } from 'react';

import { prisma } from '@/lib/prisma';

/**
 * Categories service
 * ------------------
 * Public read paths used by the storefront, sitemap, and SSR pages. We
 * read directly from Prisma instead of going through `/api/...` so the
 * sitemap stays cheap and side-effect free.
 *
 * `listCategories` is wrapped in `react.cache()` so the header (which
 * needs categories in both `MainHeader` and `NavBar`) doesn't hit the
 * DB twice per request.
 */

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  /** Direct subcategories (populated only in getCategoryBySlug). */
  children?: Pick<CategoryNode, 'id' | 'name' | 'slug' | 'icon' | 'productCount'>[];
  /** Parent category (populated only in getCategoryBySlug). */
  parent?: Pick<CategoryNode, 'id' | 'name' | 'slug'> | null;
};

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  icon: true,
  imageUrl: true,
  description: true,
  metaTitle: true,
  metaDescription: true,
  isActive: true,
  sortOrder: true,
  _count: { select: { products: true } },
} as const;

export const listCategories = cache(async (): Promise<CategoryNode[]> => {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: CATEGORY_SELECT,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parentId,
    icon: r.icon,
    imageUrl: r.imageUrl,
    description: r.description,
    metaTitle: r.metaTitle,
    metaDescription: r.metaDescription,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    productCount: r._count.products,
  }));
});

export async function getCategoryBySlug(
  slug: string
): Promise<CategoryNode | null> {
  const row = await prisma.category.findUnique({
    where: { slug },
    select: {
      ...CATEGORY_SELECT,
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, slug: true, icon: true,
          _count: { select: { products: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    icon: row.icon,
    imageUrl: row.imageUrl,
    description: row.description,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    productCount: row._count.products,
    parent: row.parent ?? null,
    children: row.children.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      productCount: c._count.products,
    })),
  };
}
