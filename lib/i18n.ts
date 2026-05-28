export { routing, isRtl } from '@/i18n/routing';
export type { Locale } from '@/i18n/routing';

export const locales = ['en', 'fa', 'ar', 'ur'] as const;
export const defaultLocale = 'en' as const;

export function isLocale(value: string): value is (typeof locales)[number] {
  return (locales as readonly string[]).includes(value);
}
