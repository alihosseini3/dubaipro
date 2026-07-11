import { getTranslations } from 'next-intl/server';

import { AcceptInviteCard } from '@/components/supplier/team/AcceptInviteCard';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

/**
 * Public landing page for supplier team invitations (linked from the invite
 * email). Token validation and acceptance happen client-side against
 * /api/supplier/team/accept — the token itself is the credential.
 */
export default async function SupplierInvitePage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'supplier.invite' });

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-center text-xl font-bold text-slate-900">{t('title')}</h1>
      <div className="mt-6">
        <AcceptInviteCard locale={locale} token={sp.token ?? ''} />
      </div>
    </div>
  );
}
