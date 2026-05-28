import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { listPublishedPosts } from '@/lib/blog/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string }> };

export const revalidate = 600;

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/blog'),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: { card: 'summary_large_image', title, description }
  };
}

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default async function BlogIndexPage({ params }: PageParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await listPublishedPosts({ take: 30 });

  return (
    <section className="space-y-8">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/blog' }
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          {t('intro')}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <Link
                href={`/${locale}/blog/${p.slug}`}
                className="block transition hover:opacity-90"
              >
                <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="space-y-2 p-4">
                  <h2 className="line-clamp-2 text-base font-semibold text-slate-900">
                    {p.title}
                  </h2>
                  <p className="line-clamp-3 text-sm text-slate-600">
                    {p.excerpt}
                  </p>
                  <div className="text-xs text-slate-500">
                    {p.authorName ? `${p.authorName} · ` : ''}
                    {fmtDate(p.publishedAt, locale)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
