import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { requireUser } from '@/lib/auth/require-user';
import { listUserConversations } from '@/lib/chat/service';

type Props = { params: Promise<{ locale: string }> };

function relativeDate(d: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default async function MessagesListPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/messages');
  const t = await getTranslations({ locale, namespace: 'chat' });

  const conversations = await listUserConversations(user.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountSidebar locale={locale} user={user} />
      <div className="space-y-4 lg:col-span-2">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('listTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('listSubtitle')}</p>
        </header>

        {conversations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto h-16 w-16 text-slate-300"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              {t('emptyTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('emptyDescription')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${locale}/account/messages/${c.id}`}
                  className="flex items-start gap-3 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {(c.peer?.name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.peer?.name ?? '—'}
                      </p>
                      <span className="flex-none text-xs text-slate-500">
                        {relativeDate(c.updatedAt, locale)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {c.lastMessage
                        ? c.lastMessage.content
                        : t('noMessagesYet')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
