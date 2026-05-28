import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { requireUser } from '@/lib/auth/require-user';
import { ChatError, getConversationForUser, listMessages } from '@/lib/chat/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ChatRoomPage({ params }: Props) {
  const { locale, id } = await params;
  const user = await requireUser(locale, `/account/messages/${id}`);
  const t = await getTranslations({ locale, namespace: 'chat' });

  let convo;
  let initialMessages;
  try {
    [convo, initialMessages] = await Promise.all([
      getConversationForUser(id, user.id),
      listMessages(id, user.id)
    ]);
  } catch (err) {
    if (err instanceof ChatError) {
      if (err.code === 'not_found') notFound();
      if (err.code === 'forbidden') notFound();
    }
    throw err;
  }

  if (!convo) notFound();

  const peer = convo.customerId === user.id ? convo.seller : convo.customer;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountSidebar locale={locale} user={user} />
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/${locale}/account/messages`}
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            {t('backToList')}
          </Link>
        </div>

        <ChatRoom
          conversationId={convo.id}
          currentUserId={user.id}
          peer={{ id: peer.id, name: peer.name, role: peer.role }}
          initialMessages={initialMessages.map((m) => ({
            id: m.id,
            content: m.content,
            senderId: m.senderId,
            createdAt: m.createdAt.toISOString(),
            senderName: m.sender.name
          }))}
          locale={locale}
        />
      </div>
    </div>
  );
}
