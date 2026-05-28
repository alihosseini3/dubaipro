import type { ReactNode } from 'react';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { requireUser } from '@/lib/auth/require-user';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AccountLayout({ children, params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account');

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-6 lg:flex-row">
        <AccountSidebar
          locale={locale}
          user={{ name: user.name, email: user.email }}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
