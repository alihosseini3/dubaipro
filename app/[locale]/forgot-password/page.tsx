import { getTranslations } from 'next-intl/server';

import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('forgotTitle'),
    description: t('forgotSubtitle')
  };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthShell
      locale={locale}
      title={t('forgotTitle')}
      subtitle={t('forgotSubtitle')}
      footerText={t('rememberPassword')}
      footerLinkLabel={t('signIn')}
      footerLinkHref={`/${locale}/login`}
    >
      <ForgotPasswordForm locale={locale} />
    </AuthShell>
  );
}
