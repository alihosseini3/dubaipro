import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import './globals.css';

import { isRtl } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site';

/**
 * Root metadata. `metadataBase` resolves all relative URLs in
 * page-level metadata (canonical, alternates, OG) to absolute ones.
 * Without it, Next.js logs a warning and emits relative canonicals,
 * which Google treats as ambiguous.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  icons: {
    icon: '/icon.svg'
  },
  description: 'Multilingual marketplace for B2B and retail buyers.',
  applicationName: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  robots: { index: true, follow: true }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
