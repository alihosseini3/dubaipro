import Link from 'next/link';
import type { Metadata } from 'next';

import type { RfqRequestStatus } from '@prisma/client';

import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { RfqStatusBadge, RfqUrgencyBadge } from '@/components/rfq/RfqStatusBadge';
import { RfqModerationActions } from '@/components/admin/RfqModerationActions';

export const metadata: Metadata = { title: 'RFQ Requests | Admin' };

const STATUS_FILTER_VALUES = ['DRAFT', 'PENDING_REVIEW', 'OPEN', 'NEGOTIATING', 'QUOTED', 'ACCEPTED', 'FULFILLED', 'CLOSED', 'CANCELLED', 'EXPIRED'] as const;

export default async function AdminRfqRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  await requireAdmin(locale);

  const status = STATUS_FILTER_VALUES.includes(sp.status as RfqRequestStatus) ? (sp.status as RfqRequestStatus) : undefined;
  const search = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 25;

  const where = {
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const [rows, total, stats] = await Promise.all([
    prisma.rfqRequest.findMany({
      where,
      select: {
        id: true, slug: true, title: true, status: true, urgency: true,
        quoteCount: true, viewCount: true, createdAt: true, shippingCountry: true,
        user: { select: { name: true, email: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rfqRequest.count({ where }),
    prisma.rfqRequest.groupBy({ by: ['status'], _count: { id: true } }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const statMap = Object.fromEntries(stats.map((s) => [s.status, s._count.id]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Enterprise RFQ Requests</h1>
          <p className="mt-0.5 text-sm text-slate-500">{total} total requests</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {STATUS_FILTER_VALUES.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
              status === s
                ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-900/20'
                : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 dark:border-slate-700 dark:bg-slate-800/40'
            }`}
          >
            <div className="text-lg font-black">{statMap[s] ?? 0}</div>
            <div>{s}</div>
          </Link>
        ))}
      </div>

      {/* Filter + search */}
      <form method="get" className="flex gap-3">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search by title…"
          className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="h-9 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600">
          Search
        </button>
        {(status || search) && (
          <Link href="?" className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs text-slate-600 hover:border-red-300 dark:border-slate-600">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              {['Title', 'Buyer', 'Category', 'Quotes', 'Views', 'Status', 'Urgency', 'Date', 'Actions'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                  No records found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/20">
                <td className="max-w-[220px] truncate px-4 py-3">
                  <Link
                    href={`/${locale}/admin/rfq/requests/${r.slug}`}
                    className="font-semibold text-slate-900 hover:text-orange-600 dark:text-white"
                  >
                    {r.title}
                  </Link>
                  <div className="mt-0.5 flex gap-2">
                    <Link
                      href={`/${locale}/rfq/${r.slug}`}
                      target="_blank"
                      className="text-[10px] text-slate-400 hover:text-orange-600"
                    >
                      View Public →
                    </Link>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{r.user.name}</p>
                  <p className="text-[10px] text-slate-400">{r.user.email}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {r.category?.name ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-orange-600">
                  {r.quoteCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center text-slate-500">
                  {r.viewCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RfqStatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RfqUrgencyBadge urgency={r.urgency} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RfqModerationActions slug={r.slug} status={r.status} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?page=${p}${status ? `&status=${status}` : ''}${search ? `&q=${search}` : ''}`}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                p === page
                  ? 'bg-orange-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300 dark:border-slate-600 dark:bg-slate-800'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

