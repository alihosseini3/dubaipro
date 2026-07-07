import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/seo/site';

/**
 * robots.txt
 *
 * Crawl rules:
 *   - Allow public storefront and content pages.
 *   - Disallow private surfaces (account, admin, supplier dashboards,
 *     auth flow, cart/checkout, raw API). These provide no SEO value
 *     and can leak personalized content if indexed.
 *   - Point crawlers at the dynamic sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/*/admin/',
          '/*/account/',
          '/*/supplier/',
          '/*/login',
          '/*/register',
          '/*/forgot-password',
          '/*/reset-password',
          '/*/cart',
          '/*/checkout'
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
