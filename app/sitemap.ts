import type { MetadataRoute } from 'next';

import { prisma } from '@/lib/prisma';
import { listAllPostSlugs } from '@/lib/blog/service';
import { listBrands } from '@/lib/brands/service';
import { listCategories } from '@/lib/categories/service';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildLocaleUrl,
  getSiteUrl
} from '@/lib/seo/site';

/**
 * Dynamic sitemap.
 *
 * Strategy:
 *   - Emit one entry per (locale, path) combination.
 *   - Use `alternates.languages` so search engines understand each entry
 *     has equivalents in every supported locale (no duplicate-content
 *     penalty for our localized URLs).
 *   - All known pages: home, products list, categories list, every
 *     product slug, every category slug.
 */

export const revalidate = 3600; // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  // Static, well-known public routes (no params).
  const staticPaths: { path: string; priority: number; freq: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1.0, freq: 'daily' },
    { path: '/products', priority: 0.9, freq: 'daily' },
    { path: '/categories', priority: 0.8, freq: 'weekly' },
    { path: '/brands', priority: 0.7, freq: 'weekly' },
    { path: '/suppliers', priority: 0.8, freq: 'daily' },
    { path: '/blog', priority: 0.7, freq: 'daily' },
    { path: '/contact', priority: 0.4, freq: 'monthly' }
  ];

  const [products, categories, brands, posts, suppliers] = await Promise.all([
    prisma.product.findMany({
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000
    }),
    listCategories(),
    listBrands(),
    listAllPostSlugs(),
    prisma.supplier.findMany({
      where: { status: 'ACTIVE', slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000
    })
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const { path, priority, freq } of staticPaths) {
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: now,
      changeFrequency: freq,
      priority,
      alternates: {
        languages: localeMap(path)
      }
    });
  }

  for (const c of categories) {
    if (c.productCount === 0) continue;
    const path = `/categories/${c.slug}`;
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: { languages: localeMap(path) }
    });
  }

  for (const b of brands) {
    if (b.productCount === 0) continue;
    const path = `/brands/${b.slug}`;
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: { languages: localeMap(path) }
    });
  }

  for (const p of products) {
    const path = `/products/${p.slug}`;
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: p.createdAt,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: { languages: localeMap(path) }
    });
  }

  for (const s of suppliers) {
    if (!s.slug) continue;
    const path = `/suppliers/${s.slug}`;
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: s.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: { languages: localeMap(path) }
    });
  }

  for (const post of posts) {
    const path = `/blog/${post.slug}`;
    entries.push({
      url: buildLocaleUrl(DEFAULT_LOCALE, path),
      lastModified: post.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.5,
      alternates: { languages: localeMap(path) }
    });
  }

  // Suppress unused-var linter noise for `base`; kept exported for clarity.
  void base;
  return entries;
}

function localeMap(pathSuffix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    out[l] = buildLocaleUrl(l, pathSuffix);
  }
  return out;
}
