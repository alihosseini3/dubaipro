import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { ProductForm } from '@/components/admin/ProductForm';
import { prisma } from '@/lib/prisma';
import { getProductAttributeValues } from '@/lib/attributes/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminEditProductPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.products' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const [product, categories, brands, suppliers] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
  ]);

  if (!product) notFound();

  const attrValues = await getProductAttributeValues(id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/products`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
          >
            ← {tCommon('back')}
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{t('edit')}</h1>
        </div>
        <DeleteButton
          endpoint={`/api/products/${product.id}`}
          redirectTo={`/${locale}/admin/products`}
        />
      </header>

      <AdminCard>
        <ProductForm
          initial={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            description: product.description,
            price: Number(product.price),
            currency: product.currency,
            stock: product.stock,
            isB2B: product.isB2B,
            categoryId: product.categoryId,
            brandId: product.brandId ?? '',
            supplierId: product.supplierId,
            // Cover image + gallery — without these the form would
            // re-render with empty uploaders on every edit and look
            // like the previous images had been wiped.
            imageUrl: product.imageUrl ?? null,
            images: Array.isArray(product.images)
              ? (product.images as string[])
              : [],
            weight: product.weight ?? null,
            length: product.length ?? null,
            width: product.width ?? null,
            height: product.height ?? null,
            shippingClass: product.shippingClass ?? 'normal',
            metaTitle: product.metaTitle ?? '',
            metaDescription: product.metaDescription ?? ''
          }}
          categories={categories}
          brands={brands}
          suppliers={suppliers}
          locale={locale}
          initialAttrValues={attrValues}
        />
      </AdminCard>
    </div>
  );
}
