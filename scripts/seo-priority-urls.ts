/**
 * Print 5–10 high-priority URLs to feed into
 * Google Search Console → URL Inspection → Request Indexing.
 *
 * Run:
 *   NEXT_PUBLIC_SITE_URL=https://your-domain.com npx tsx scripts/seo-priority-urls.ts
 *
 * Strategy:
 *   1. Home (default locale)
 *   2. Products list
 *   3. Categories index
 *   4. Top 2 categories by product count
 *   5. Top N most recent in-stock products
 */
import { prisma } from '../lib/prisma';

const LOCALES = ['en', 'fa', 'ar', 'ur'] as const;
const DEFAULT_LOCALE = 'en';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    console.error('ERROR: NEXT_PUBLIC_SITE_URL is not set.');
    process.exit(1);
  }
  return raw.replace(/\/+$/, '');
}

async function main() {
  const base = getSiteUrl();
  const urls: string[] = [];

  // 1–3 — static high-traffic pages (default locale only — submit one per page)
  urls.push(`${base}/${DEFAULT_LOCALE}`);
  urls.push(`${base}/${DEFAULT_LOCALE}/products`);
  urls.push(`${base}/${DEFAULT_LOCALE}/categories`);

  // 4 — top 2 categories by product count
  const topCategories = await prisma.category.findMany({
    take: 2,
    orderBy: { products: { _count: 'desc' } },
    select: { slug: true }
  });
  for (const c of topCategories) {
    urls.push(`${base}/${DEFAULT_LOCALE}/categories/${c.slug}`);
  }

  // 5 — top 5 newest in-stock products
  const topProducts = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { slug: true }
  });
  for (const p of topProducts) {
    urls.push(`${base}/${DEFAULT_LOCALE}/products/${p.slug}`);
  }

  console.log('\n=== Submit these URLs to GSC → URL Inspection → Request Indexing ===\n');
  urls.forEach((u, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${u}`));
  console.log(`\nTotal: ${urls.length} URLs`);
  console.log(`\nAlso submit your sitemap: ${base}/sitemap.xml`);
  console.log(`Locales available: ${LOCALES.join(', ')}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
