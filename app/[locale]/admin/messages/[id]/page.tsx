import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { roleHasPermission } from '@/lib/auth/permissions';
import { getConversationForAdmin, MessagingError } from '@/lib/messaging/service';

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * Read-only conversation oversight. Requires 'conversations.oversee'
 * (SUPER_ADMIN tier) on top of the admin gate — regular admins see the list
 * on /admin/messages but not thread contents.
 */
export default async function AdminConversationPage({ params }: Props) {
  const { locale, id } = await params;
  const admin = await requireAdmin(locale, `/${locale}/admin/messages/${id}`);
  if (!roleHasPermission(admin, 'conversations.oversee')) {
    redirect(`/${locale}/admin/messages`);
  }
  const t = await getTranslations({ locale, namespace: 'admin.messages' });

  let conversation;
  try {
    conversation = await getConversationForAdmin(id);
  } catch (error) {
    if (error instanceof MessagingError) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/messages`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← {t('back')}
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {conversation.subject ?? conversation.type}
          </h1>
          <p className="text-xs text-slate-500">
            {conversation.members
              .map((m) => `${m.user.name} (${m.memberRole})`)
              .join(' · ')}
            {conversation.supplier ? ` — ${conversation.supplier.name}` : ''}
          </p>
        </div>
        <span className="ms-auto rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase text-amber-700">
          {t('readOnly')}
        </span>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {conversation.messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('noMessages')}</p>
        ) : (
          conversation.messages.map((message) => (
            <div key={message.id} className="rounded-xl bg-slate-50 px-4 py-2">
              <p className="text-[11px] font-bold text-slate-500">
                {message.sender.name}
                <span className="ms-2 font-normal text-slate-400">
                  {message.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
                {message.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
