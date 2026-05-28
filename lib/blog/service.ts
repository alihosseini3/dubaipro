import { prisma } from '@/lib/prisma';

export type FaqItem = { q: string; a: string };

export type BlogPostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  authorName: string | null;
  publishedAt: Date | null;
};

export type BlogPostDetail = BlogPostListItem & {
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  faqs: FaqItem[];
  productIds: string[];
  updatedAt: Date;
};

/** Validate untrusted JSON `faqs` payload from DB into `FaqItem[]`. */
function parseFaqs(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (it): it is FaqItem =>
        !!it &&
        typeof it === 'object' &&
        typeof (it as FaqItem).q === 'string' &&
        typeof (it as FaqItem).a === 'string'
    )
    .slice(0, 20);
}

/** Posts visible publicly: `publishedAt` is set and not in the future. */
function publicWhere() {
  return {
    publishedAt: { lte: new Date(), not: null }
  } as const;
}

export async function listPublishedPosts(params?: {
  skip?: number;
  take?: number;
}): Promise<BlogPostListItem[]> {
  const rows = await prisma.blogPost.findMany({
    where: publicWhere(),
    orderBy: { publishedAt: 'desc' },
    skip: params?.skip,
    take: params?.take ?? 30,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      authorName: true,
      publishedAt: true
    }
  });
  return rows;
}

export async function getPostBySlug(
  slug: string
): Promise<BlogPostDetail | null> {
  const row = await prisma.blogPost.findUnique({ where: { slug } });
  if (!row) return null;
  // Hide drafts/scheduled posts from the public detail page.
  if (!row.publishedAt || row.publishedAt > new Date()) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverImage: row.coverImage,
    authorName: row.authorName,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    faqs: parseFaqs(row.faqs),
    productIds: row.productIds
  };
}

/** Fetch products referenced by a post — preserves caller-provided order. */
export async function getPostLinkedProducts(productIds: string[]) {
  if (productIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      imageUrl: true
    }
  });
  const byId = new Map(rows.map((p) => [p.id, p]));
  return productIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;
}

export async function listAllPostSlugs(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  return prisma.blogPost.findMany({
    where: publicWhere(),
    select: { slug: true, updatedAt: true }
  });
}
