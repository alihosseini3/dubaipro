import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { SamplesManager } from '@/components/supplier/samples/SamplesManager';

type Props = { params: Promise<{ locale: string }> };

/** Org sample-request queue with the accept/decline/ship/close workflow. */
export default async function SupplierSamplesPage({ params }: Props) {
  const { locale } = await params;
  await requireSupplierPermission(
    locale,
    'supplier.samples.manage',
    `/${locale}/supplier/samples`
  );
  const t = await getTranslations({ locale, namespace: 'samples' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('supplierTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('supplierSubtitle')}</p>
      </div>
      <SamplesManager locale={locale} />
    </div>
  );
}
