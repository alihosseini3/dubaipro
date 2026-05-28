import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('resetTitle'),
    description: t('resetSubtitle')
  };
}

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthShell
      locale={locale}
      title={t('resetTitle')}
      subtitle={t('resetSubtitle')}
      footerText={t('rememberPassword')}
      footerLinkLabel={t('signIn')}
      footerLinkHref={`/${locale}/login`}
    >
      {/* `useSearchParams` requires a Suspense boundary in Next 15 server
          components. */}
      <Suspense fallback={null}>
        <ResetPasswordForm locale={locale} />
      </Suspense>
    </AuthShell>
  );
}
