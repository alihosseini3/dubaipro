import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ExperimentDetail } from '@/components/admin/ExperimentDetail';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamic = 'force-dynamic';

export default async function AdminExperimentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.experiments' });

  // Pre-flight existence check so we 404 cleanly before the client
  // component starts polling /api/.
  const exists = await prisma.experiment
    .findUnique({ where: { id }, select: { id: true } })
    .catch(() => null);
  if (!exists) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('detailTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('detailSubtitle')}</p>
      </header>
      <ExperimentDetail id={id} locale={locale} />
    </div>
  );
}
