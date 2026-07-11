import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { getConversationHeader, MessagingError } from '@/lib/messaging/service';
import { MessageThread } from '@/components/messaging/MessageThread';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function SupplierMessageThreadPage({ params }: Props) {
  const { locale, id } = await params;
  const { user } = await requireSupplierPermission(
    locale,
    'supplier.messages',
    `/${locale}/supplier/messages/${id}`
  );
  const t = await getTranslations({ locale, namespace: 'messaging' });

  let header;
  try {
    header = await getConversationHeader(id, user.id);
  } catch (error) {
    if (error instanceof MessagingError) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/supplier/messages`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
        >
          ← {t('back')}
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {header.counterpartName}
          </h1>
          {header.subject && (
            <p className="truncate text-xs text-slate-500">{header.subject}</p>
          )}
        </div>
        {header.product && (
          <Link
            href={`/${locale}/products/${header.product.slug}`}
            className="ms-auto hidden rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 sm:block dark:bg-slate-700 dark:text-slate-200"
          >
            {t('viewProduct')}
          </Link>
        )}
      </div>
      <MessageThread
        conversationId={id}
        viewerId={user.id}
        locale={locale}
        archived={false}
      />
    </div>
  );
}
