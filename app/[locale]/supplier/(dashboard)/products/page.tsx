/* eslint-disable */
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

import { requireSupplier } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';
import { AdminCard } from '@/components/admin/AdminCard';

export const metadata: Metadata = { title: 'My Products | Supplier' };

export default async function SupplierProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const { supplier } = await requireSupplier(locale, `/${locale}/supplier/products`);

  const statusFilter = sp.status === 'published' ? true : sp.status === 'draft' ? false : undefined;
  const search = sp.q?.trim();

  const where = {
    supplierId: supplier.id,
    ...(statusFilter !== undefined ? { isPublished: statusFilter } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const countSelect: any = { b2bInquiries: true };
  const include: any = {
    category: { select: { name: true } },
    _count: { select: countSelect },
  };
  const productQuery: any = {
    where,
    orderBy: { createdAt: 'desc' },
    include,
  };
  const groupByQuery: any = {
    by: ['isPublished'],
    where: { supplierId: supplier.id },
    _count: { id: true },
  };
  const [products, stats] = await Promise.all([
    prisma.product.findMany(productQuery),
    prisma.product.groupBy(groupByQuery),
  ]);

  const statMap = Object.fromEntries((stats as any[]).map((s: any) => [s.isPublished ? 'published' : 'draft', s._count.id]));
  const total = products.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your B2B product catalog</p>
        </div>
        <Link
          href={`/${locale}/supplier/products/new`}
          className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
        >
          + Add New Product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href={`?`}
          className={`rounded-xl border p-4 text-center transition ${
            !sp.status
              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{total}</div>
          <div className="text-xs font-medium text-slate-500">All Products</div>
        </Link>
        <Link
          href={`?status=published`}
          className={`rounded-xl border p-4 text-center transition ${
            sp.status === 'published'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className="text-2xl font-bold text-green-600">{statMap.published ?? 0}</div>
          <div className="text-xs font-medium text-slate-500">Published</div>
        </Link>
        <Link
          href={`?status=draft`}
          className={`rounded-xl border p-4 text-center transition ${
            sp.status === 'draft'
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className="text-2xl font-bold text-amber-600">{statMap.draft ?? 0}</div>
          <div className="text-xs font-medium text-slate-500">Drafts</div>
        </Link>
      </div>

      {/* Search */}
      <form method="get" className="flex gap-3">
        <input type="hidden" name="status" value={sp.status || ''} />
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search products..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800"
        >
          Search
        </button>
        {(sp.q || sp.status) && (
          <Link
            href={`/${locale}/supplier/products`}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:border-red-300 dark:border-slate-600"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-4xl">📦</div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No products yet</h3>
            <p className="mt-1 text-sm text-slate-500">Start building your B2B catalog by adding your first product.</p>
            <Link
              href={`/${locale}/supplier/products/new`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              + Add First Product
            </Link>
          </div>
        ) : (
          products.map((product: any) => {
            const p = product as Record<string, any>;
            return (
            <div
              key={p.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/60"
            >
              {/* Image */}
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title}
                    fill
                    className="object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">📷</div>
                )}
                <div className="absolute left-2 top-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      p.isPublished
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50'
                    }`}
                  >
                    {p.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="mt-3">
                <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white">{p.title}</h3>
                <p className="text-xs text-slate-500">{p.category?.name || 'No category'}</p>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-orange-600">{Number(p.price).toFixed(2)}</span>
                  <span className="text-sm text-slate-500">{p.currency}</span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                  <div>
                    <div className="font-semibold text-slate-700">{p.moq || 1}</div>
                    <div>MOQ</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700">{p.stock}</div>
                    <div>Stock</div>
                  </div>
                  <div>
                    <div className="font-semibold text-orange-600">{p._count?.b2bInquiries || 0}</div>
                    <div>Inquiries</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/${locale}/supplier/products/${p.id}/edit`}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/${locale}/products/${p.slug}`}
                    target="_blank"
                    className="flex-1 rounded-lg bg-orange-50 py-2 text-center text-xs font-bold text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          );})
        )}
      </div>
    </div>
  );
}
