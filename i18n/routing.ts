import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'fa', 'ar', 'ur'],
  defaultLocale: 'en'
});

export type Locale = (typeof routing.locales)[number];

export const rtlLocales: readonly Locale[] = ['fa', 'ar', 'ur'];

export function isRtl(locale: Locale): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}
