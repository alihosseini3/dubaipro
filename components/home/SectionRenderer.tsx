import type { HomepageSectionDTO } from '@/lib/homepage/types';

import { AuctionSection } from './AuctionSection';
import { BecomeSupplierSection } from './BecomeSupplierSection';
import { BlogSection } from './BlogSection';
import { CategoriesSection } from './CategoriesSection';
import { FeaturedProductsSection } from './FeaturedProductsSection';
import { GlobalShoppingSection } from './GlobalShoppingSection';
import { HeroSection } from './HeroSection';
import { TopSuppliersSection } from './TopSuppliersSection';
import { TrustSection } from './TrustSection';

type Props = {
  locale: string;
  sections: HomepageSectionDTO[];
};

/**
 * Public homepage dispatcher. Walks the admin-defined section list in
 * order and renders the matching component. Unknown / not-yet-shipped
 * types (eg. AUCTION, BLOG, GLOBAL_SHOPPING, TOP_SUPPLIERS) silently
 * skip — the admin can stage them now and the renderer will pick them
 * up when phase 2 lands.
 */
export function SectionRenderer({ locale, sections }: Props) {
  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
          case 'HERO':
            return <HeroSection key={section.id} locale={locale} section={section} />;
          case 'CATEGORIES':
            return (
              <CategoriesSection key={section.id} locale={locale} section={section} />
            );
          case 'FEATURED_PRODUCTS':
            return (
              <FeaturedProductsSection
                key={section.id}
                locale={locale}
                section={section}
              />
            );
          case 'TRUST':
            return <TrustSection key={section.id} section={section} />;
          case 'BECOME_SUPPLIER':
            return (
              <BecomeSupplierSection
                key={section.id}
                locale={locale}
                section={section}
              />
            );
          case 'GLOBAL_SHOPPING':
            return (
              <GlobalShoppingSection
                key={section.id}
                locale={locale}
                section={section}
              />
            );
          case 'TOP_SUPPLIERS':
            return (
              <TopSuppliersSection
                key={section.id}
                locale={locale}
                section={section}
              />
            );
          case 'AUCTION':
            return (
              <AuctionSection key={section.id} locale={locale} section={section} />
            );
          case 'BLOG':
            return <BlogSection key={section.id} locale={locale} section={section} />;
          default:
            return null;
        }
      })}
    </>
  );
}
