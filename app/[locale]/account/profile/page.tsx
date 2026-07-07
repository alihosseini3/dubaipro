import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { ProfileForm } from '@/components/account/ProfileForm';
import { requireUser } from '@/lib/auth/require-user';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountProfilePage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/profile');

  // Suppliers manage their account from the richer store profile, which
  // also includes the same name/email and password controls.
  if (user.role === 'SUPPLIER') {
    redirect(`/${locale}/supplier/profile`);
  }

  const t = await getTranslations({ locale, namespace: 'account' });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{t('profileTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('profileSubtitle')}</p>
      </header>
      <ProfileForm initial={{ name: user.name, email: user.email }} />
      <ChangePasswordForm />
    </div>
  );
}
