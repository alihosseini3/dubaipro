import { getTranslations } from 'next-intl/server';

import { CategoryManager, type CategoryRow } from '@/components/admin/CategoryManager';
import { prisma } from '@/lib/prisma';
import { listAttributes } from '@/lib/attributes/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCategoriesPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.categories' });

  const [categories, allAttributes] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true, children: true } },
      },
    }),
    listAttributes(),
  ]);

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    icon: c.icon,
    imageUrl: c.imageUrl,
    description: c.description,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c._count.products,
    childCount: c._count.children,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <CategoryManager initialCategories={rows} allAttributes={allAttributes} />
    </div>
  );
}
