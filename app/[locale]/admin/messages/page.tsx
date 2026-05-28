import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { ContactMessageRow } from '@/components/admin/ContactMessageRow';
import { listAllConversations } from '@/lib/chat/service';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminMessagesPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.messages' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  // Internal chat conversations (existing) + guest contact-form submissions
  // (new). Both are loaded server-side so the admin sees a unified inbox.
  const [rows, contactRows] = await Promise.all([
    listAllConversations({ take: 200 }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-slate-500">
            {tCommon('empty')}
          </p>
        </AdminCard>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  t('headerCustomer'),
                  t('headerSeller'),
                  t('headerMessages'),
                  t('headerUpdated')
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {c.customer.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {c.customer.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {c.seller.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {c.seller.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {c._count.messages}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {c.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <header className="pt-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {t('contactTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('contactSubtitle')}</p>
      </header>

      {contactRows.length === 0 ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-slate-500">
            {tCommon('empty')}
          </p>
        </AdminCard>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  t('contactHeaderName'),
                  t('contactHeaderEmail'),
                  t('contactHeaderMessage'),
                  t('contactHeaderCreated')
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contactRows.map((m) => (
                <ContactMessageRow
                  key={m.id}
                  locale={locale}
                  message={{
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    subject: m.subject,
                    message: m.message,
                    userId: m.userId,
                    status: m.status,
                    createdAt: m.createdAt,
                    replyContent: m.replyContent,
                    replySentAt: m.replySentAt,
                    conversationId: m.conversationId
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
