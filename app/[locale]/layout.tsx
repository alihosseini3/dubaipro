import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { FloatingChatHubButton } from '@/components/chat/FloatingChatHubButton';
import { Footer } from '@/components/footer';
import { Header, MobileBottomNav } from '@/components/header';
import { UtmCapture } from '@/components/analytics/UtmCapture';
import { RetargetingPixels } from '@/components/marketing/RetargetingPixels';
import { ToastStack } from '@/components/ui/ToastStack';
import { routing } from '@/i18n/routing';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  // Admin and auth routes render their own chrome — skip the public navbar/footer.
  const segments = pathname.split('/');
  const isStandalone =
    segments.includes('admin') ||
    segments.includes('login') ||
    segments.includes('register');

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col" data-bottom-nav="1">
      <Header locale={locale} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 md:px-6 lg:px-8">{children}</main>
      <Footer />
      {/* Bottom tab bar — mobile only (md:hidden inside the component). */}
      <MobileBottomNav locale={locale} />
      {/* Single global entry-point for every "talk to us" channel. */}
      <FloatingChatHubButton locale={locale} />
      <UtmCapture />
      {/* Retargeting pixels + consent banner. Server-resolves visibility
          so there is no flicker and no client-side waterfall. */}
      <RetargetingPixels />
      <ToastStack />
    </div>
  );
}
