import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { TeamManager } from '@/components/supplier/team/TeamManager';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Supplier team management — invite employees, change roles, deactivate.
 * Gated by 'supplier.team.manage' (OWNER / MANAGER only); other members are
 * redirected back to the dashboard home.
 */
export default async function SupplierTeamPage({ params }: Props) {
  const { locale } = await params;
  const { member } = await requireSupplierPermission(
    locale,
    'supplier.team.manage',
    `/${locale}/supplier/team`
  );

  const t = await getTranslations({ locale, namespace: 'supplier.team' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>
      <TeamManager locale={locale} viewerMemberId={member.id} />
    </div>
  );
}
