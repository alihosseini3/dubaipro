import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { SectionRenderer } from '@/components/cms/SectionRenderer';
import { getPageBySlug } from '@/lib/pages/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription,
} from '@/lib/seo/site';

type Params = {
  params: Promise<{ locale: string; slug: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) {
    return { title: composeTitle('Not found'), robots: { index: false } };
  }

  const title = page.metaTitle?.trim() || page.title;
  const description = truncateDescription(
    page.metaDescription?.trim() || page.title
  );
  const seo = page.seo;

  return {
    title: composeTitle(title),
    description,
    alternates: {
      ...buildAlternates(locale, `/${page.slug}`),
      ...(seo?.canonicalUrl ? { canonical: seo.canonicalUrl } : {}),
    },
    robots: seo?.robots
      ? { index: !seo.robots.includes('noindex'), follow: !seo.robots.includes('nofollow') }
      : undefined,
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
      ...(seo?.ogImage ? { images: [{ url: seo.ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(seo?.ogImage ? { images: [seo.ogImage] } : {}),
    },
  };
}

export default async function CmsPage({ params }: Params) {
  const { locale, slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const hasSections = page.sections.length > 0;
  const hasLegacyBody = !hasSections && page.body.trim().length > 0;

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: 'Home', path: '/' },
          { name: page.title, path: `/${page.slug}` },
        ]}
      />

      {page.seo?.structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(page.seo.structuredData),
          }}
        />
      )}

      {hasSections ? (
        <SectionRenderer sections={page.sections} />
      ) : hasLegacyBody ? (
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-10">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {page.title}
            </h1>
          </header>
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        </article>
      ) : (
        <article className="mx-auto max-w-3xl space-y-6 px-4 py-10">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {page.title}
            </h1>
          </header>
          <p className="text-sm text-slate-500">This page has no content yet.</p>
        </article>
      )}
    </>
  );
}
