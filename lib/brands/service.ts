import { prisma } from '@/lib/prisma';

export type BrandNode = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export async function listBrands(): Promise<BrandNode[]> {
  const rows = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: true } }
    }
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    productCount: r._count.products
  }));
}

export async function getBrandBySlug(slug: string): Promise<BrandNode | null> {
  const row = await prisma.brand.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: true } }
    }
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    productCount: row._count.products
  };
}
