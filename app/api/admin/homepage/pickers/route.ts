import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { handlePrismaError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Picker search endpoint for the admin homepage builder.
 *
 *   GET /api/admin/homepage/pickers?type=product&q=foo
 *   GET /api/admin/homepage/pickers?type=product&ids=cuid1,cuid2
 *
 * `type` selects the entity to search/resolve. `q` is a case-insensitive
 * substring filter (capped at 25 results). `ids` resolves the names of
 * an existing selection so the picker can show readable chips for IDs
 * the admin already saved.
 *
 * The response shape is intentionally identical across entities so the
 * client picker can stay generic — `{ id, label, hint?, imageUrl? }`.
 */

type PickerEntity = 'product' | 'category' | 'supplier' | 'post';

const ENTITIES: ReadonlySet<PickerEntity> = new Set([
  'product',
  'category',
  'supplier',
  'post'
]);

type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  imageUrl?: string | null;
};

const TAKE = 25;

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type') as PickerEntity | null;
  const q = (url.searchParams.get('q') ?? '').trim();
  const idsRaw = url.searchParams.get('ids') ?? '';
  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!type || !ENTITIES.has(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }

  try {
    let data: PickerItem[];
    switch (type) {
      case 'product':
        data = await searchProducts({ q, ids });
        break;
      case 'category':
        data = await searchCategories({ q, ids });
        break;
      case 'supplier':
        data = await searchSuppliers({ q, ids });
        break;
      case 'post':
        data = await searchPosts({ q, ids });
        break;
    }
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, `GET /api/admin/homepage/pickers ${type}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Per-entity loaders                                                         */
/* -------------------------------------------------------------------------- */

async function searchProducts({
  q,
  ids
}: {
  q: string;
  ids: string[];
}): Promise<PickerItem[]> {
  // `ids` mode: resolve a known selection in caller-provided order.
  if (ids.length > 0) {
    const rows = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        category: { select: { name: true } }
      }
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        label: r.title,
        hint: r.category?.name,
        imageUrl: r.imageUrl
      }));
  }

  // Search mode.
  const rows = await prisma.product.findMany({
    where: q ? { title: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: TAKE,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      category: { select: { name: true } }
    }
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.title,
    hint: r.category?.name,
    imageUrl: r.imageUrl
  }));
}

async function searchCategories({
  q,
  ids
}: {
  q: string;
  ids: string[];
}): Promise<PickerItem[]> {
  if (ids.length > 0) {
    const rows = await prisma.category.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: true } }
      }
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        label: r.name,
        hint: `${r._count.products} products`
      }));
  }

  const rows = await prisma.category.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: TAKE,
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } }
    }
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    hint: `${r._count.products} products`
  }));
}

async function searchSuppliers({
  q,
  ids
}: {
  q: string;
  ids: string[];
}): Promise<PickerItem[]> {
  if (ids.length > 0) {
    const rows = await prisma.supplier.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        country: true,
        verified: true
      }
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.verified ? `${r.country} · Verified` : r.country
      }));
  }

  const rows = await prisma.supplier.findMany({
    where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
    take: TAKE,
    select: {
      id: true,
      name: true,
      country: true,
      verified: true
    }
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    hint: r.verified ? `${r.country} · Verified` : r.country
  }));
}

async function searchPosts({
  q,
  ids
}: {
  q: string;
  ids: string[];
}): Promise<PickerItem[]> {
  if (ids.length > 0) {
    const rows = await prisma.blogPost.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        coverImage: true,
        publishedAt: true,
        authorName: true
      }
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        label: r.title,
        hint: r.publishedAt
          ? r.publishedAt.toISOString().slice(0, 10)
          : 'Draft',
        imageUrl: r.coverImage
      }));
  }

  const rows = await prisma.blogPost.findMany({
    where: q
      ? {
          title: { contains: q, mode: 'insensitive' },
          publishedAt: { not: null }
        }
      : { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: TAKE,
    select: {
      id: true,
      title: true,
      coverImage: true,
      publishedAt: true
    }
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.title,
    hint: r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : 'Draft',
    imageUrl: r.coverImage
  }));
}
