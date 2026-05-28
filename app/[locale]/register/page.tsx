import { getTranslations } from 'next-intl/server';

import { AuthShell } from '@/components/auth/AuthShell';
import { AuthPlaceholders } from '@/components/auth/AuthPlaceholders';
import { RegisterForm } from '@/components/auth/RegisterForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('signUpTitle'),
    description: t('signUpSubtitle')
  };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthShell
      locale={locale}
      title={t('signUpTitle')}
      subtitle={t('signUpSubtitle')}
      footerText={t('haveAccount')}
      footerLinkLabel={t('signIn')}
      footerLinkHref={`/${locale}/login`}
      brandTagline={t('registerTagline')}
      brandDescription={t('registerDescription')}
    >
      <div className="space-y-5">
        <RegisterForm locale={locale} />
        <AuthPlaceholders />
      </div>
    </AuthShell>
  );
}
