import { getTranslations } from 'next-intl/server';

import { MarketingHub } from '@/components/admin/marketing/MarketingHub';

type Props = { params: Promise<{ locale: string }> };

export const dynamic = 'force-dynamic';

export default async function AdminMarketingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.campaigns' });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-[13px] text-slate-500">{t('subtitle')}</p>
        </div>
      </header>
      <MarketingHub />
    </div>
  );
}
