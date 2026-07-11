import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { ConversationListView } from '@/components/messaging/ConversationListView';

type Props = { params: Promise<{ locale: string }> };

/**
 * Supplier unified inbox: DIRECT contacts, product inquiries, and sample
 * threads for the whole org. Gated by 'supplier.messages' (OWNER / MANAGER /
 * MESSAGING_AGENT).
 */
export default async function SupplierMessagesPage({ params }: Props) {
  const { locale } = await params;
  await requireSupplierPermission(
    locale,
    'supplier.messages',
    `/${locale}/supplier/messages`
  );
  const t = await getTranslations({ locale, namespace: 'messaging' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('inboxTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('supplierInboxSubtitle')}</p>
      </div>
      <ConversationListView
        locale={locale}
        basePath={`/${locale}/supplier/messages`}
      />
    </div>
  );
}
