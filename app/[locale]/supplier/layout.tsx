import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { requireSupplier } from '@/lib/auth/require-supplier';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function SupplierLayout({ children, params }: Props) {
  const { locale } = await params;
  const { supplier } = await requireSupplier(locale, `/${locale}/supplier`);
  const t = await getTranslations({ locale, namespace: 'supplier.nav' });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('panel')}
          </p>
          <h1 className="text-xl font-semibold text-slate-900">
            {supplier.name}
          </h1>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link
            href={`/${locale}/supplier`}
            className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            {t('overview')}
          </Link>
          <Link
            href={`/${locale}/supplier/analytics`}
            className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            {t('analytics')}
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
