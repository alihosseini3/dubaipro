import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
  WebPageJsonLd
} from '@/components/seo/JsonLd';
import {
  getPostBySlug,
  getPostLinkedProducts
} from '@/lib/blog/service';
import {
  SITE_NAME,
  buildAlternates,
  buildLocaleUrl,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 600;

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const post = await getPostBySlug(slug);
  if (!post) {
    return {
      title: composeTitle(t('notFoundTitle')),
      robots: { index: false, follow: false }
    };
  }

  const titleBase = post.metaTitle?.trim() || post.title;
  const description = truncateDescription(
    post.metaDescription?.trim() || post.excerpt
  );
  const path = `/blog/${post.slug}`;
  const canonical = buildLocaleUrl(locale, path);

  return {
    title: composeTitle(titleBase),
    description,
    alternates: buildAlternates(locale, path),
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: titleBase,
      description,
      url: canonical,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
      images: post.coverImage ? [post.coverImage] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.authorName ? [post.authorName] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: titleBase,
      description,
      images: post.coverImage ? [post.coverImage] : undefined
    }
  };
}

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default async function BlogPostPage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const linkedProducts = await getPostLinkedProducts(post.productIds);
  const url = buildLocaleUrl(locale, `/blog/${post.slug}`);
  const description = truncateDescription(
    post.metaDescription?.trim() || post.excerpt
  );

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <ArticleJsonLd
        url={url}
        headline={post.title}
        description={description}
        image={post.coverImage}
        authorName={post.authorName}
        datePublished={(post.publishedAt ?? post.updatedAt).toISOString()}
        dateModified={post.updatedAt.toISOString()}
        locale={locale}
      />
      <WebPageJsonLd
        type="ItemPage"
        url={url}
        name={post.title}
        description={description}
        locale={locale}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` }
        ]}
      />
      <FaqJsonLd items={post.faqs} />

      <nav className="text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-slate-900">
          {t('home')}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/${locale}/blog`} className="hover:text-slate-900">
          {t('title')}
        </Link>
      </nav>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {post.title}
        </h1>
        <div className="text-xs text-slate-500">
          {post.authorName ? `${post.authorName} · ` : ''}
          {fmtDate(post.publishedAt, locale)}
        </div>
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.title}
            className="aspect-[16/9] w-full rounded-xl object-cover"
          />
        ) : null}
        <p className="text-base leading-relaxed text-slate-700">
          {post.excerpt}
        </p>
      </header>

      {/*
        Body is sanitized HTML produced by the admin editor (trusted).
        Tailwind typography ensures readable defaults without ad-hoc CSS.
      */}
      <div
        className="prose prose-slate max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: post.body }}
      />

      {linkedProducts.length > 0 && (
        <section
          aria-labelledby="related-products"
          className="rounded-2xl border border-slate-100 bg-white p-5"
        >
          <h2
            id="related-products"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500"
          >
            {t('relatedProducts')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {linkedProducts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${locale}/products/${p.slug}`}
                  className="group block overflow-hidden rounded-xl border border-slate-100 transition hover:border-slate-300"
                >
                  <div className="aspect-square w-full overflow-hidden bg-slate-50">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-xs font-medium text-slate-900">
                      {p.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {Number(p.price).toFixed(2)} {p.currency ?? 'USD'}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {post.faqs.length > 0 && (
        <section
          aria-labelledby="faq"
          className="rounded-2xl border border-slate-100 bg-white p-5"
        >
          <h2
            id="faq"
            className="mb-4 text-lg font-semibold text-slate-900"
          >
            {t('faqTitle')}
          </h2>
          <dl className="space-y-4">
            {post.faqs.map((it, i) => (
              <div key={i}>
                <dt className="text-sm font-semibold text-slate-900">{it.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                  {it.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}
