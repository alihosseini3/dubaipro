import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SectionRenderer } from '@/components/home/SectionRenderer';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';
import { localizeSections } from '@/lib/homepage/localize';
import { listActiveSections } from '@/lib/homepage/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/'),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

/**
 * Public storefront homepage. The actual content is data-driven: every
 * band on the page is a `HomepageSection` row managed from
 * `/admin/homepage`. The renderer fans out by `type` and the service
 * seeds sensible defaults the first time the table is read empty, so
 * a fresh install still ships a complete homepage.
 */
export default async function LocaleHomePage({ params }: PageParams) {
  const { locale } = await params;
  // `localizeSections` is a no-op for `en` and otherwise translates
  // every user-facing string through the cached i18n pipeline. New
  // copy added by admins gets translated automatically on first hit.
  const rawSections = await listActiveSections();
  const sections = await localizeSections(rawSections, locale);

  return (
    <section className="space-y-12 py-2 md:space-y-16">
      <OrganizationJsonLd />
      <WebSiteJsonLd locale={locale} />
      <SectionRenderer locale={locale} sections={sections} />
    </section>
  );
}
