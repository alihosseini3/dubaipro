import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AuthShell } from '@/components/auth/AuthShell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('signUpTitle'),
    description: t('signUpSubtitle')
  };
}

const cardClass =
  'group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-orange-400 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20';

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthShell
      locale={locale}
      title={t('chooseAccountTitle')}
      subtitle={t('chooseAccountSubtitle')}
      footerText={t('haveAccount')}
      footerLinkLabel={t('signIn')}
      footerLinkHref={`/${locale}/login`}
      brandTagline={t('registerTagline')}
      brandDescription={t('registerDescription')}
    >
      <div className="grid gap-4">
        {/* Buyer */}
        <Link href={`/${locale}/register/buyer`} className={cardClass}>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
              <path d="M6 2l-1 4h14l-1-4M3 6h18l-2 13a2 2 0 01-2 2H7a2 2 0 01-2-2L3 6zM9 10v4m6-4v4" />
            </svg>
          </span>
          <span className="mt-4 text-lg font-semibold text-slate-900">{t('accountBuyerTitle')}</span>
          <span className="mt-1 text-sm text-slate-500">{t('accountBuyerDesc')}</span>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
            {t('accountContinue')}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden>
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </span>
        </Link>

        {/* Supplier */}
        <Link href={`/${locale}/supplier/register`} className={cardClass}>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
              <path d="M3 9h13v8H3zM16 12h4l2 3v2h-6M6 21a2 2 0 100-4 2 2 0 000 4zM18 21a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </span>
          <span className="mt-4 text-lg font-semibold text-slate-900">{t('accountSupplierTitle')}</span>
          <span className="mt-1 text-sm text-slate-500">{t('accountSupplierDesc')}</span>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
            {t('accountContinue')}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden>
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </span>
        </Link>
      </div>
    </AuthShell>
  );
}
