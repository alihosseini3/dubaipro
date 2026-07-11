/**
 * Notification registry — pure data, unit-testable, no I/O.
 *
 * Every notification type declares its default channels (in-app is always
 * on; email/whatsapp are opt-in here). `email: true` means the template has
 * localized subject/body copy in `notifications.emails.*` of every
 * messages/<locale>.json — rendered in the recipient's preferredLocale by
 * lib/notifications/email-i18n.ts.
 *
 * Template keys are dot-scoped. Message-key mapping replaces dots with
 * underscores ("product.approved" → product_approved).
 */

export type NotificationChannel = 'inApp' | 'email' | 'whatsapp';

export type NotificationParams = Record<string, string | number>;

export type TemplateDefinition = {
  channels: NotificationChannel[];
  /** Localized email copy exists under notifications.emails.* */
  email?: boolean;
};

export const NOTIFICATION_TEMPLATES = {
  'product.approved': { channels: ['inApp', 'email'], email: true },
  'product.rejected': { channels: ['inApp', 'email'], email: true },
  /** Debounced: only fired when the recipient had no unread messages in the thread. */
  'message.new': { channels: ['inApp'] },
  'sample.requested': { channels: ['inApp', 'email'], email: true },
  'sample.status': { channels: ['inApp', 'email'], email: true },
  'team.member.joined': { channels: ['inApp'] },
  'broadcast.announcement': { channels: ['inApp'] },
  'subscription.assigned': { channels: ['inApp', 'email'], email: true },
  'subscription.expiring': { channels: ['inApp', 'email'], email: true },
  'subscription.expired': { channels: ['inApp', 'email'], email: true }
} as const satisfies Record<string, TemplateDefinition>;

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES;

export function getTemplate(key: NotificationTemplateKey): TemplateDefinition {
  return NOTIFICATION_TEMPLATES[key];
}

/** i18n key fragment for a template ("product.approved" → "product_approved"). */
export function templateToMessageKey(templateKey: string): string {
  return templateKey.replace(/\./g, '_');
}
