import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { ReviewQueueManager } from '@/components/admin/ReviewQueueManager';

type Props = { params: Promise<{ locale: string }> };

/**
 * Product review queue — PENDING_REVIEW submissions in FIFO order.
 * Approve publishes (with the supplier's isPublished switch), reject
 * requires a reason that is shown to the supplier.
 */
export default async function AdminReviewQueuePage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/products/review-queue`);
  const t = await getTranslations({ locale, namespace: 'admin.reviewQueue' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <ReviewQueueManager locale={locale} />
    </div>
  );
}
