/**
 * Client-side rendering helpers for notifications: template key + params →
 * localized text via the `notifications.items.*` message keys.
 */

export type NotificationItem = {
  id: string;
  templateKey: string;
  params: Record<string, string | number> | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type Translator = (key: string, params?: Record<string, string | number>) => string;

/** "product.approved" → i18n key "items.product_approved". */
export function renderNotificationText(
  t: Translator,
  item: NotificationItem
): string {
  const key = `items.${item.templateKey.replace(/\./g, '_')}`;
  try {
    return t(key, item.params ?? {});
  } catch {
    // Unknown/renamed template key — degrade to the raw key, never crash.
    return item.templateKey;
  }
}

/** Locale-prefix the stored (locale-less) link. */
export function notificationHref(locale: string, item: NotificationItem): string | null {
  if (!item.link) return null;
  return item.link.startsWith('/') ? `/${locale}${item.link}` : item.link;
}
