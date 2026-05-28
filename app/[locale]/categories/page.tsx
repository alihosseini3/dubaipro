import type { Metadata } from 'next';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { getTranslations } from 'next-intl/server';

import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { listCategories } from '@/lib/categories/service';
import type { CategoryNode } from '@/lib/categories/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'categories' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/categories'),
    openGraph: {
      type: 'website', siteName: SITE_NAME, title, description,
      locale: toOgLocale(locale), alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: { card: 'summary_large_image', title, description }
  };
}

const ACCENTS = [
  'bg-orange-50 text-orange-600 border-orange-100',
  'bg-sky-50 text-sky-600 border-sky-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-violet-50 text-violet-600 border-violet-100',
  'bg-rose-50 text-rose-600 border-rose-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-cyan-50 text-cyan-600 border-cyan-100',
  'bg-lime-50 text-lime-600 border-lime-100',
];

function CategoryCard({ cat, locale, idx, subcategories }: {
  cat: CategoryNode;
  locale: string;
  idx: number;
  subcategories?: CategoryNode[];
}) {
  const accent = ACCENTS[idx % ACCENTS.length];
  const href = `/${locale}/categories/${cat.slug}`;
  return (
    <li>
      <Link
        href={href}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      >
        {/* Banner image */}
        {cat.imageUrl ? (
          <div className="relative h-36 w-full overflow-hidden bg-slate-100">
            <SmartImage
              src={cat.imageUrl}
              alt={cat.name}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {cat.icon && (
              <span className="absolute bottom-3 left-4 text-3xl drop-shadow">{cat.icon}</span>
            )}
          </div>
        ) : (
          <div className={`flex h-20 items-center px-5 ${accent} border-b`}>
            <span className="text-4xl">{cat.icon || cat.name.slice(0, 1)}</span>
          </div>
        )}

        <div className="flex flex-1 flex-col p-4">
          <h2 className="text-sm font-bold text-slate-900 transition group-hover:text-indigo-700">
            {cat.name}
          </h2>
          {cat.description && (
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{cat.description}</p>
          )}
          <p className="mt-auto pt-2 text-[11px] font-medium text-slate-400">
            {cat.productCount} products
          </p>

          {/* Subcategory chips */}
          {subcategories && subcategories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {subcategories.slice(0, 4).map((sub: CategoryNode) => (
                <span key={sub.id}
                  className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                  {sub.icon && <span>{sub.icon}</span>}
                  {sub.name}
                </span>
              ))}
              {subcategories.length > 4 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                  +{subcategories.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

export default async function CategoriesIndexPage({ params }: PageParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'categories' });
  const all = await listCategories();

  const roots = all.filter((c) => !c.parentId);
  const childMap = new Map<string, CategoryNode[]>();
  all.forEach((c) => {
    if (c.parentId) {
      const arr = childMap.get(c.parentId) ?? [];
      arr.push(c);
      childMap.set(c.parentId, arr);
    }
  });

  return (
    <section className="space-y-8">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/categories' }
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="max-w-2xl text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      {roots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          {t('empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roots.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              locale={locale}
              idx={idx}
              subcategories={childMap.get(cat.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
