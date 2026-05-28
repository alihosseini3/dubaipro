import { getTranslations } from 'next-intl/server';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthPlaceholders } from '@/components/auth/AuthPlaceholders';
import { LoginForm } from '@/components/auth/LoginForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('signInTitle'),
    description: t('signInSubtitle')
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthShell
      locale={locale}
      title={t('signInTitle')}
      subtitle={t('signInSubtitle')}
      footerText={t('noAccount')}
      footerLinkLabel={t('signUp')}
      footerLinkHref={`/${locale}/register`}
    >
      <div className="space-y-5">
        <LoginForm locale={locale} />
        <AuthPlaceholders />
      </div>
    </AuthShell>
  );
}
