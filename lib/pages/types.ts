/**
 * CMS page section type definitions.
 * Each section type has a strongly-typed `config` shape.
 * The union `SectionConfig` is used in DTOs and the editor.
 */

export type PageSectionType =
  | 'HERO'
  | 'RICH_TEXT'
  | 'IMAGE_BANNER'
  | 'CTA_BLOCK'
  | 'FEATURES_GRID'
  | 'FAQ'
  | 'SPACER'
  | 'PRODUCT_GRID'
  | 'STATS'
  | 'TRUST_SECTION'
  | 'SUPPLIER_SHOWCASE'
  | 'BLOG_POSTS'
  | 'AUCTION_SHOWCASE';

export const PAGE_SECTION_TYPES: PageSectionType[] = [
  'HERO',
  'RICH_TEXT',
  'IMAGE_BANNER',
  'CTA_BLOCK',
  'FEATURES_GRID',
  'FAQ',
  'SPACER',
  'PRODUCT_GRID',
  'STATS',
  'TRUST_SECTION',
  'SUPPLIER_SHOWCASE',
  'BLOG_POSTS',
  'AUCTION_SHOWCASE',
];

export type PageStatus = 'DRAFT' | 'PUBLISHED';

/* -------------------------------------------------------------------------- */
/* Per-section config shapes                                                  */
/* -------------------------------------------------------------------------- */

export type HeroConfig = {
  heading?: string;
  subheading?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  badge?: string;
  overlayOpacity?: number;
  textAlign?: 'left' | 'center' | 'right';
};

export type RichTextConfig = {
  html?: string;
};

export type ImageBannerConfig = {
  imageUrl?: string;
  alt?: string;
  href?: string;
  caption?: string;
  aspectRatio?: '16/9' | '4/3' | '21/9' | 'auto';
};

export type CtaBlockConfig = {
  heading?: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  variant?: 'default' | 'accent' | 'dark';
};

export type FeaturesGridConfig = {
  heading?: string;
  subheading?: string;
  columns?: 2 | 3 | 4;
  items?: Array<{
    icon?: string;
    title?: string;
    description?: string;
  }>;
};

export type FaqConfig = {
  heading?: string;
  items?: Array<{
    question?: string;
    answer?: string;
  }>;
};

export type SpacerConfig = {
  height?: 'sm' | 'md' | 'lg' | 'xl';
};

export type ProductGridConfig = {
  heading?: string;
  subheading?: string;
  source?: 'latest' | 'featured' | 'category';
  categorySlug?: string;
  limit?: number;
  sort?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
};

export type StatsConfig = {
  heading?: string;
  items?: Array<{ value?: string; label?: string; prefix?: string; suffix?: string }>;
};

export type TrustSectionConfig = {
  heading?: string;
  items?: Array<{ icon?: string; title?: string; description?: string }>;
  variant?: 'icons' | 'logos';
};

export type SupplierShowcaseConfig = {
  heading?: string;
  subheading?: string;
  limit?: number;
};

export type BlogPostsConfig = {
  heading?: string;
  limit?: number;
  category?: string;
};

export type AuctionShowcaseConfig = {
  heading?: string;
  limit?: number;
  status?: 'active' | 'upcoming' | 'all';
};

export type SectionConfig =
  | HeroConfig
  | RichTextConfig
  | ImageBannerConfig
  | CtaBlockConfig
  | FeaturesGridConfig
  | FaqConfig
  | SpacerConfig
  | ProductGridConfig
  | StatsConfig
  | TrustSectionConfig
  | SupplierShowcaseConfig
  | BlogPostsConfig
  | AuctionShowcaseConfig;

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export type PageSectionDTO = {
  id: string;
  pageId: string;
  type: PageSectionType;
  order: number;
  config: SectionConfig;
  isVisible: boolean;
};

export type PageSeoDTO = {
  pageId: string;
  ogImage: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  structuredData: Record<string, unknown> | null;
};

export type PageDTO = {
  id: string;
  title: string;
  slug: string;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  status: PageStatus;
  locale: string;
  isActive: boolean;
  order: number;
  sections: PageSectionDTO[];
  seo: PageSeoDTO | null;
  createdAt: string;
  updatedAt: string;
};

export type PageSummaryDTO = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  locale: string;
  isActive: boolean;
  order: number;
  sectionCount: number;
  hasSeo: boolean;
  updatedAt: string;
};
