import Link from 'next/link';

import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { listPublishedPosts } from '@/lib/blog/service';
import { localizeArray } from '@/lib/i18n/localize';
import { prisma } from '@/lib/prisma';

import { SectionHeader } from './CategoriesSection';
import { ArrowRightIcon } from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

/**
 * Editorial / SEO band — 2–6 blog cards.
 *
 * Source order:
 *   1. `config.postIds` (admin curated). Missing IDs (deleted /
 *      unpublished posts) are skipped silently.
 *   2. Otherwise, the latest published posts (already index-backed
 *      via `publishedAt` on the BlogPost model).
 *
 * Cards intentionally lean on cover images — when missing, the card
 * falls back to a coloured wash with the post title bigger so the
 * grid still feels intentional.
 */
export async function BlogSection({ locale, section }: Props) {
  const cfgIds = (section.config.postIds as string[] | undefined) ?? [];
  const limit = clamp((section.config.limit as number | undefined) ?? 3, 2, 6);

  const rawPosts = await loadPosts(cfgIds, limit);
  if (rawPosts.length === 0) return null;
  // Translate post title + excerpt. Author name stays as-is so credit
  // lines remain accurate.
  const posts = await localizeArray(rawPosts, locale, ['title', 'excerpt']);

  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section aria-labelledby="home-blog" className="space-y-6">
      <SectionHeader
        id="home-blog"
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={ctaHref}
      />

      <ul
        className={`grid gap-4 ${
          posts.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`${base}/blog/${p.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverImage}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-6 text-center">
                    <span className="line-clamp-3 text-base font-bold text-slate-400">
                      {p.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 transition group-hover:text-orange-700">
                  {p.title}
                </h3>
                {p.excerpt && (
                  <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                    {p.excerpt}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-3 text-xs">
                  {p.authorName ? (
                    <span className="text-slate-500">By {p.authorName}</span>
                  ) : p.publishedAt ? (
                    <time className="text-slate-500" dateTime={p.publishedAt.toISOString()}>
                      {p.publishedAt.toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </time>
                  ) : (
                    <span />
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold text-orange-600">
                    Read
                    <ArrowRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------- Loader -------- */

type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  authorName: string | null;
  publishedAt: Date | null;
};

async function loadPosts(
  pinnedIds: string[],
  limit: number
): Promise<PostCard[]> {
  if (pinnedIds.length > 0) {
    // Curated mode — preserve admin order and only return posts that
    // are actually published (drafts shouldn't sneak in via a pinned
    // ID list).
    const rows = await prisma.blogPost
      .findMany({
        where: {
          id: { in: pinnedIds },
          publishedAt: { lte: new Date(), not: null }
        },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImage: true,
          authorName: true,
          publishedAt: true
        }
      })
      .catch(() => []);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }

  return listPublishedPosts({ take: limit }).catch(() => []);
}

/* -------- Helpers -------- */

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
