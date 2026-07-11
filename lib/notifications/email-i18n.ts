import 'server-only';

import { createTranslator } from 'next-intl';

import { routing } from '@/i18n/routing';

import type { NotificationParams } from './registry';
import { templateToMessageKey } from './registry';

/**
 * Locale-aware rendering for OUTBOUND notification channels (email/WhatsApp).
 * Uses the same messages/*.json catalog as the UI — copy lives in one place —
 * keyed by `notifications.emails.<template>_subject|_body` and rendered in
 * the recipient's `User.preferredLocale`.
 *
 * (In-app notifications don't come through here: they store templateKey+params
 * and render client-side in the viewer's live locale.)
 */

type Messages = Record<string, unknown>;

// Static map keeps the imports analyzable by the bundler.
const MESSAGE_LOADERS: Record<string, () => Promise<{ default: Messages }>> = {
  en: () => import('@/messages/en.json'),
  fa: () => import('@/messages/fa.json'),
  ar: () => import('@/messages/ar.json'),
  ur: () => import('@/messages/ur.json')
};

export function normalizeLocale(locale: string | null | undefined): string {
  return locale && (routing.locales as readonly string[]).includes(locale)
    ? locale
    : routing.defaultLocale;
}

export async function renderNotificationEmail(
  templateKey: string,
  params: NotificationParams,
  preferredLocale: string
): Promise<{ subject: string; text: string }> {
  const locale = normalizeLocale(preferredLocale);
  const load = MESSAGE_LOADERS[locale] ?? MESSAGE_LOADERS[routing.defaultLocale];
  const messages = (await load()).default;

  const t = createTranslator({
    locale,
    messages: messages as Parameters<typeof createTranslator>[0]['messages'],
    namespace: 'notifications.emails'
  });

  const key = templateToMessageKey(templateKey);
  return {
    subject: t(`${key}_subject`, params),
    text: t(`${key}_body`, params)
  };
}
