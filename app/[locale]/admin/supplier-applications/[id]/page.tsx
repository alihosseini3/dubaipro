import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { SupplierApplicationActions } from '@/components/admin/SupplierApplicationActions';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminSupplierApplicationDetailPage({ params }: Props) {
  const { locale, id } = await params;
  await requireAdmin(locale, `/${locale}/admin/supplier-applications`);
  const t = await getTranslations({ locale, namespace: 'adminSuppliers' });

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
      documents: { select: { id: true, type: true, fileUrl: true } },
      primaryCategory: { select: { name: true } },
      secondaryCategories: { include: { category: { select: { name: true } } } },
    },
  });
  if (!supplier) notFound();

  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: t('companyName'),  value: supplier.companyName },
    { label: t('tradeName'),    value: supplier.tradeName },
    { label: t('tradeLicense'), value: supplier.tradeLicenseNumber },
    { label: t('companyType'),  value: supplier.companyType ?? undefined },
    { label: t('country'),      value: supplier.country },
    { label: t('emirate'),      value: supplier.emirate },
    { label: t('city'),         value: supplier.city },
    { label: t('phones'),       value: supplier.phones.join(', ') || undefined },
    {
      label: t('categories'),
      value: [
        supplier.primaryCategory?.name,
        ...supplier.secondaryCategories.map((sc) => sc.category.name),
      ]
        .filter(Boolean)
        .join(', ') || undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/supplier-applications`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
        >
          ← {t('backToList')}
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {t('detailTitle', { name: supplier.name })}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile info + documents */}
        <div className="space-y-6 lg:col-span-2">
          <AdminCard title={t('sectionProfile')}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {fields.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{value ?? <span className="text-slate-300">—</span>}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{supplier.user.email}</dd>
              </div>
            </dl>

            {/* Banner / logo preview */}
            {(supplier.bannerUrl || supplier.logoUrl) && (
              <div className="mt-4 flex gap-4">
                {supplier.bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={supplier.bannerUrl} alt="Banner" className="h-20 w-48 rounded-lg object-cover ring-1 ring-slate-200" />
                )}
                {supplier.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={supplier.logoUrl} alt="Logo" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
                )}
              </div>
            )}
          </AdminCard>

          <AdminCard title={t('sectionDocuments')}>
            {supplier.documents.length === 0 ? (
              <p className="text-sm text-slate-400">{t('noDocuments')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {supplier.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.type.replace(/_/g, ' ')}</p>
                    </div>
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t('viewDocument')}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        {/* Right: actions */}
        <div>
          <SupplierApplicationActions
            locale={locale}
            supplierId={supplier.id}
            onboardingStatus={supplier.onboardingStatus}
            accountStatus={supplier.status}
            verified={supplier.verified}
            canListProducts={supplier.canListProducts}
          />
        </div>
      </div>
    </div>
  );
}
