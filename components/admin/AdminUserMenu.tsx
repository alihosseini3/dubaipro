import { getTranslations } from 'next-intl/server';
import type { UserRole } from '@prisma/client';

import { RoleBadge } from '@/components/auth/RoleBadge';
import { SignOutButton } from '@/components/auth/SignOutButton';
import type { SessionUser } from '@/lib/auth/session';

type AdminUserMenuProps = {
  user: SessionUser;
  locale: string;
};

export async function AdminUserMenu({ user, locale }: AdminUserMenuProps) {
  const t = await getTranslations({ locale, namespace: 'auth.role' });
  const initial = user.name.trim().charAt(0).toUpperCase() || 'A';

  const roleLabels: Partial<Record<UserRole, string>> = {
    ADMIN: t('admin'),
    SUPPLIER: t('supplier'),
    SELLER: t('seller'),
    CUSTOMER: t('customer')
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
        aria-hidden
      >
        {initial}
      </div>
      <div className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-semibold text-slate-800">{user.name}</span>
        <RoleBadge role={user.role} labels={roleLabels} className="mt-0.5 w-fit" />
      </div>
      <SignOutButton locale={locale} variant="button" className="ml-2" />
    </div>
  );
}
