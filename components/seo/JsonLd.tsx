import type { Product } from '@/types/product';
import { SITE_NAME, buildLocaleUrl, getSiteUrl } from '@/lib/seo/site';

/**
 * JSON-LD components
 * ------------------
 * All structured data emitted by the site goes through these components
 * so we keep one place to validate / extend the schema.org coverage.
 *
 * Rules:
 *   - We never inject untrusted HTML — payload is JSON-stringified into
 *     the script content, and `<` is escaped to neutralize </script>
 *     injection in user-generated descriptions.
 *   - The script type MUST be `application/ld+json`. Any other type is
 *     ignored by Googlebot.
 */

function safeJson(payload: unknown): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

type JsonLdProps = { data: Record<string, unknown> | Array<Record<string, unknown>> };

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Product                                                            */
/* ------------------------------------------------------------------ */

export type ProductReviewLite = {
  author: string;
  rating: number;
  body: string;
  datePublished: string;
};

export type ProductRatingStats = { average: number; count: number };

export type ProductShippingConfig = {
  currency?: string;
  rate?: number;
  country?: string;
  handlingTimeMinDays?: number;
  handlingTimeMaxDays?: number;
  transitTimeMinDays?: number;
  transitTimeMaxDays?: number;
};

const DEFAULT_SHIPPING = {
  rate: 0,
  country: 'WORLDWIDE',
  handlingTimeMinDays: 1,
  handlingTimeMaxDays: 2,
  transitTimeMinDays: 3,
  transitTimeMaxDays: 7
} as const;

export function ProductJsonLd({
  product,
  locale,
  url,
  rating,
  reviews,
  shipping,
  priceValidUntil
}: {
  product: Product;
  locale: string;
  url: string;
  rating?: ProductRatingStats;
  reviews?: ProductReviewLite[];
  shipping?: ProductShippingConfig;
  priceValidUntil?: string;
}) {
  const images = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...((product.images ?? []) as string[])
  ].filter(Boolean);

  const availability =
    product.stock > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';

  const currency = product.currency ?? 'USD';
  const validUntil =
    priceValidUntil ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const ship = { ...DEFAULT_SHIPPING, ...(shipping ?? {}) };
  const shipCurrency = ship.currency ?? currency;

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price: Number(product.price).toFixed(2),
    priceCurrency: currency,
    priceValidUntil: validUntil,
    availability,
    url,
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: Number(ship.rate ?? 0).toFixed(2),
        currency: shipCurrency
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        ...(ship.country === 'WORLDWIDE'
          ? { geoMidpoint: { '@type': 'GeoCoordinates' } }
          : { addressCountry: ship.country })
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: ship.handlingTimeMinDays,
          maxValue: ship.handlingTimeMaxDays,
          unitCode: 'DAY'
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: ship.transitTimeMinDays,
          maxValue: ship.transitTimeMaxDays,
          unitCode: 'DAY'
        }
      }
    }
  };

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: (product.description ?? '').slice(0, 5000),
    sku: product.id,
    image: images.length > 0 ? images : undefined,
    inLanguage: locale,
    url,
    offers: offer
  };

  if (product.brand?.name) {
    data.brand = { '@type': 'Brand', name: product.brand.name };
  }
  if (product.category?.name) {
    data.category = product.category.name;
  }

  if (rating && rating.count > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(rating.average).toFixed(1),
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1
    };
  }

  if (reviews && reviews.length > 0) {
    data.review = reviews.slice(0, 2).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewBody: r.body.slice(0, 1000),
      datePublished: r.datePublished,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1
      }
    }));
  }

  return <JsonLd data={data} />;
}

/* ------------------------------------------------------------------ */
/* WebPage (ProductPage)                                              */
/* ------------------------------------------------------------------ */

export function WebPageJsonLd({
  type = 'WebPage',
  url,
  name,
  description,
  locale,
  breadcrumbId
}: {
  type?: 'WebPage' | 'ProductPage' | 'CollectionPage' | 'ItemPage';
  url: string;
  name: string;
  description?: string;
  locale: string;
  /** Optional @id of a co-located BreadcrumbList. */
  breadcrumbId?: string;
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': url,
    url,
    name,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: getSiteUrl() }
  };
  if (description) data.description = description;
  if (breadcrumbId) data.breadcrumb = { '@id': breadcrumbId };
  return <JsonLd data={data} />;
}

/* ------------------------------------------------------------------ */
/* Breadcrumb                                                         */
/* ------------------------------------------------------------------ */

export type BreadcrumbItem = {
  name: string;
  /** Path AFTER the locale segment, e.g. '/products' or '/products/foo'. */
  path: string;
};

export function BreadcrumbJsonLd({
  items,
  locale
}: {
  items: BreadcrumbItem[];
  locale: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: it.name,
          item: buildLocaleUrl(locale, it.path)
        }))
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Sitewide                                                           */
/* ------------------------------------------------------------------ */

export function OrganizationJsonLd() {
  const base = getSiteUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: base,
        logo: `${base}/icon.png`
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                */
/* ------------------------------------------------------------------ */

export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((it) => ({
          '@type': 'Question',
          name: it.q,
          acceptedAnswer: { '@type': 'Answer', text: it.a }
        }))
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Article                                                            */
/* ------------------------------------------------------------------ */

export function ArticleJsonLd({
  url,
  headline,
  description,
  image,
  authorName,
  datePublished,
  dateModified,
  locale
}: {
  url: string;
  headline: string;
  description?: string;
  image?: string | null;
  authorName?: string | null;
  /** ISO datetime */
  datePublished: string;
  dateModified?: string;
  locale: string;
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: headline.slice(0, 110),
    inLanguage: locale,
    datePublished,
    dateModified: dateModified ?? datePublished,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${getSiteUrl()}/icon.png`
      }
    }
  };
  if (description) data.description = description;
  if (image) data.image = [image];
  if (authorName) {
    data.author = { '@type': 'Person', name: authorName };
  }
  return <JsonLd data={data} />;
}

export function WebSiteJsonLd({ locale }: { locale: string }) {
  const base = getSiteUrl();
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: buildLocaleUrl(locale, '/'),
        inLanguage: locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${base}/${locale}/products?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      }}
    />
  );
}
