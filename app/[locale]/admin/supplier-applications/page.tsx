import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { SupplierOnboardingStatus } from '@prisma/client';

import { AdminCard } from '@/components/admin/AdminCard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string>> };

const ONBOARDING_BADGE: Record<SupplierOnboardingStatus, string> = {
  DRAFT:    'bg-slate-100 text-slate-600',
  PENDING:  'bg-amber-50  text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};
const ACCOUNT_BADGE: Record<string, string> = {
  ACTIVE:         'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PENDING_REVIEW: 'bg-amber-50  text-amber-700 ring-1 ring-amber-200',
  SUSPENDED:      'bg-red-50 text-red-700 ring-1 ring-red-200',
  BLACKLISTED:    'bg-red-50 text-red-700 ring-1 ring-red-200',
};

export default async function AdminSupplierApplicationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  await requireAdmin(locale, `/${locale}/admin/supplier-applications`);
  const t = await getTranslations({ locale, namespace: 'adminSuppliers' });

  const filter = (sp.filter ?? 'ALL') as SupplierOnboardingStatus | 'ALL';
  const q = sp.q?.trim() ?? '';

  const suppliers = await prisma.supplier.findMany({
    where: {
      ...(filter !== 'ALL' ? { onboardingStatus: filter } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      companyName: true,
      status: true,
      onboardingStatus: true,
      verified: true,
      canListProducts: true,
      createdAt: true,
      documents: { select: { id: true }, take: 1 },
      user: { select: { email: true } },
    },
  });

  const FILTERS: Array<{ key: SupplierOnboardingStatus | 'ALL'; label: string }> = [
    { key: 'ALL',      label: t('filterAll') },
    { key: 'DRAFT',    label: t('filterDraft') },
    { key: 'PENDING',  label: t('filterPending') },
    { key: 'APPROVED', label: t('filterApproved') },
    { key: 'REJECTED', label: t('filterRejected') },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <AdminCard>
        {/* Filter bar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => (
              <Link
                key={key}
                href={`/${locale}/admin/supplier-applications?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  filter === key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
          </div>
          <form method="GET" action={`/${locale}/admin/supplier-applications`} className="flex">
            {filter !== 'ALL' && <input type="hidden" name="filter" value={filter} />}
            <input
              name="q"
              defaultValue={q}
              placeholder={t('searchPlaceholder')}
              className="min-w-[220px] rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            />
          </form>
        </div>

        {/* Table */}
        {suppliers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">{t('colName')}</th>
                  <th className="pb-3 pr-4">{t('colStatus')}</th>
                  <th className="pb-3 pr-4">{t('colAccount')}</th>
                  <th className="pb-3 pr-4">{t('colDocuments')}</th>
                  <th className="pb-3 pr-4">{t('colDate')}</th>
                  <th className="pb-3">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      {s.companyName && <p className="text-xs text-slate-400">{s.companyName}</p>}
                      <p className="text-xs text-slate-400">{s.user.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ONBOARDING_BADGE[s.onboardingStatus]}`}>
                        {t(`status${s.onboardingStatus}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_BADGE[s.status] ?? ACCOUNT_BADGE.PENDING_REVIEW}`}>
                        {t(`account${s.status}` as Parameters<typeof t>[0])}
                      </span>
                      {s.verified && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">✓</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium ${s.documents.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {s.documents.length > 0 ? '✓' : '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/${locale}/admin/supplier-applications/${s.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {t('viewDetails')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
