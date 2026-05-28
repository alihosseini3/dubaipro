import { getTranslations } from 'next-intl/server';

import { ReferralDashboard } from '@/components/account/ReferralDashboard';
import { requireUser } from '@/lib/auth/require-user';
import { ensureReferralCode } from '@/lib/referral/code';
import {
  getReferralStats,
  listMyCommissions
} from '@/lib/referral/service';
import { getSiteUrl } from '@/lib/seo/site';

type Props = { params: Promise<{ locale: string }> };

export const dynamic = 'force-dynamic';

export default async function ReferralPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.referral' });
  const user = await requireUser(locale, `/${locale}/account/referral`);

  const code = await ensureReferralCode(user.id);
  const [stats, commissions] = await Promise.all([
    getReferralStats(user.id),
    listMyCommissions(user.id, 100)
  ]);

  const shareLink = `${getSiteUrl()}/${locale}?ref=${code}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <ReferralDashboard
        code={code}
        shareLink={shareLink}
        stats={{ ...stats, code }}
        commissions={commissions.map((c) => ({
          id: c.id,
          orderId: c.orderId,
          amount: Number(c.amount),
          currency: c.currency,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          paidAt: c.paidAt ? c.paidAt.toISOString() : null
        }))}
      />
    </div>
  );
}
