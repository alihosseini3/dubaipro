import Link from 'next/link';
import { Prisma, UserRole } from '@prisma/client';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { UsersFilters } from '@/components/admin/UsersFilters';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ role?: string; q?: string }>;
};

const ALL_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.CUSTOMER,
  UserRole.SELLER,
  UserRole.SUPPLIER
];

function parseRoleFilter(raw: string | undefined): UserRole | undefined {
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  return (ALL_ROLES as readonly string[]).includes(up)
    ? (up as UserRole)
    : undefined;
}

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'admin.users' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const roleFilter = parseRoleFilter(sp.role);
  const query = sp.q?.trim() ?? '';

  // Build Prisma where clause: role is an exact match; query is a
  // case-insensitive match on either `name` or `email`.
  const where: Prisma.UserWhereInput = {};
  if (roleFilter) where.role = roleFilter;
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } }
    }
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/users/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {t('addUser')}
        </Link>
      </header>

      <UsersFilters locale={locale} />

      <p className="text-xs text-slate-500">{t('rolesPlaceholder')}</p>

      {users.length === 0 ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-slate-500">
            {tCommon('empty')}
          </p>
        </AdminCard>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  t('headerName'),
                  t('headerEmail'),
                  t('headerRole'),
                  t('headerOrders'),
                  t('headerJoined')
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="group cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/${locale}/admin/users/${u.id}`}
                      className="block font-medium text-slate-900 group-hover:underline"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/${locale}/admin/users/${u.id}`}
                      className="block font-mono text-xs text-slate-500"
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/${locale}/admin/users/${u.id}`}
                      className="block"
                    >
                      <StatusBadge status={u.role} variant="role" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle tabular-nums text-slate-700">
                    <Link href={`/${locale}/admin/users/${u.id}`} className="block">
                      {u._count.orders}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle tabular-nums text-slate-600">
                    <Link href={`/${locale}/admin/users/${u.id}`} className="block">
                      {u.createdAt.toISOString().slice(0, 10)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
