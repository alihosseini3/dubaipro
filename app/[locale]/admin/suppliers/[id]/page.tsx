import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { SupplierForm } from '@/components/admin/SupplierForm';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminEditSupplierPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.suppliers' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          isActive: true,
          user: { select: { name: true, email: true } }
        }
      }
    }
  });
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/suppliers`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
          >
            ← {tCommon('back')}
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{t('edit')}</h1>
        </div>
        <DeleteButton
          endpoint={`/api/suppliers/${supplier.id}`}
          redirectTo={`/${locale}/admin/suppliers`}
        />
      </header>

      <AdminCard>
        <SupplierForm
          initial={{
            id: supplier.id,
            userId: supplier.userId,
            name: supplier.name,
            country: supplier.country,
            phone: supplier.phone ?? '',
            verified: supplier.verified
          }}
          users={[]}
          locale={locale}
        />
      </AdminCard>

      <AdminCard>
        <h2 className="text-sm font-semibold text-slate-900">{t('teamTitle')}</h2>
        {supplier.members.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t('teamEmpty')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 text-start">{t('teamMember')}</th>
                  <th className="px-2 py-2 text-start">{t('teamRole')}</th>
                  <th className="px-2 py-2 text-start">{t('teamStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {supplier.members.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{m.user.name}</div>
                      <div className="text-xs text-slate-500">{m.user.email}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{m.role}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ' +
                          (m.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-100 text-slate-500 ring-slate-200')
                        }
                      >
                        {m.isActive ? t('teamActive') : t('teamInactive')}
                      </span>
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
