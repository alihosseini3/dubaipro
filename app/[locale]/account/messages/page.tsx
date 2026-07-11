import { getTranslations } from 'next-intl/server';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { requireUser } from '@/lib/auth/require-user';
import { ConversationListView } from '@/components/messaging/ConversationListView';

type Props = { params: Promise<{ locale: string }> };

/** Buyer inbox — member-based conversations with filters, search, archive. */
export default async function MessagesListPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/messages');
  const t = await getTranslations({ locale, namespace: 'messaging' });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountSidebar locale={locale} user={user} />
      <div className="space-y-4 lg:col-span-2">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('inboxTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('inboxSubtitle')}</p>
        </header>
        <ConversationListView
          locale={locale}
          basePath={`/${locale}/account/messages`}
        />
      </div>
    </div>
  );
}
