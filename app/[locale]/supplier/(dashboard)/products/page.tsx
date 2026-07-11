import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ProductStatus, type Prisma } from '@prisma/client';

import { requireSupplier } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';

const STATUS_ORDER: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.PENDING_REVIEW,
  ProductStatus.APPROVED,
  ProductStatus.REJECTED,
  ProductStatus.ARCHIVED
];

const STATUS_TONE: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/50',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50',
  ARCHIVED: 'bg-slate-200 text-slate-500 dark:bg-slate-700'
};

function parseStatus(value: string | undefined): ProductStatus | undefined {
  return STATUS_ORDER.find((s) => s === value);
}

export default async function SupplierProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const { supplier } = await requireSupplier(locale, `/${locale}/supplier/products`);
  const t = await getTranslations({ locale, namespace: 'supplier.products' });

  const statusFilter = parseStatus(sp.status);
  const search = sp.q?.trim();

  const where: Prisma.ProductWhereInput = {
    supplierId: supplier.id,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? { title: { contains: search, mode: 'insensitive' as const } }
      : {})
  };

  const [products, stats] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
        stock: true,
        status: true,
        isPublished: true,
        rejectionReason: true,
        imageUrl: true,
        moq: true,
        category: { select: { name: true } },
        _count: {
          select: { conversations: { where: { type: 'INQUIRY' } } }
        }
      }
    }),
    prisma.product.groupBy({
      by: ['status'],
      where: { supplierId: supplier.id },
      _count: { _all: true }
    })
  ]);

  const statMap = Object.fromEntries(stats.map((s) => [s.status, s._count._all]));
  const totalAll = stats.reduce((sum, s) => sum + s._count._all, 0);

  const statusLabel = (s: ProductStatus) =>
    t(`status.${s}` as Parameters<typeof t>[0]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/supplier/products/new`}
          className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
        >
          + {t('addNew')}
        </Link>
      </div>

      {/* Status filter tiles */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Link
          href="?"
          className={`rounded-xl border p-3 text-center transition ${
            !statusFilter
              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {totalAll}
          </div>
          <div className="text-[11px] font-medium text-slate-500">{t('all')}</div>
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={`rounded-xl border p-3 text-center transition ${
              statusFilter === s
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {statMap[s] ?? 0}
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {statusLabel(s)}
            </div>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="get" className="flex gap-3">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <input
          name="q"
          defaultValue={sp.q}
          placeholder={t('searchPlaceholder')}
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          className="h-10 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800"
        >
          {t('search')}
        </button>
        {(sp.q || sp.status) && (
          <Link
            href={`/${locale}/supplier/products`}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm text-slate-600 hover:border-red-300 dark:border-slate-600"
          >
            {t('clear')}
          </Link>
        )}
      </form>

      {/* Products grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-4xl">📦</div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {t('emptyTitle')}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{t('emptyBody')}</p>
            <Link
              href={`/${locale}/supplier/products/new`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              + {t('addFirst')}
            </Link>
          </div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title}
                    fill
                    className="object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">
                    📷
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${STATUS_TONE[p.status]}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-500">{p.category?.name ?? '—'}</p>

                {p.status === 'REJECTED' && p.rejectionReason && (
                  <p className="mt-1 line-clamp-2 rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-900/30">
                    {p.rejectionReason}
                  </p>
                )}

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-orange-600">
                    {Number(p.price).toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-500">{p.currency}</span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      {p.moq ?? 1}
                    </div>
                    <div>{t('moq')}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      {p.stock}
                    </div>
                    <div>{t('stock')}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-orange-600">
                      {p._count.conversations}
                    </div>
                    <div>{t('inquiries')}</div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/${locale}/supplier/products/${p.id}/edit`}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                  >
                    {t('edit')}
                  </Link>
                  {p.status === 'APPROVED' && p.isPublished && (
                    <Link
                      href={`/${locale}/products/${p.slug}`}
                      target="_blank"
                      className="flex-1 rounded-lg bg-orange-50 py-2 text-center text-xs font-bold text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20"
                    >
                      {t('view')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
