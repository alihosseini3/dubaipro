/**
 * Notification registry — pure data, unit-testable, no I/O.
 *
 * Every notification type declares:
 *   - default channels (in-app is always on; email/whatsapp are opt-in here)
 *   - an English email renderer (emails are locale-less v1; in-app copy is
 *     localized client-side from `notifications.items.*` message keys)
 *
 * Template keys are dot-scoped. The client maps them to i18n keys by
 * replacing dots with underscores ("product.approved" → items.product_approved).
 */

export type NotificationChannel = 'inApp' | 'email' | 'whatsapp';

export type NotificationParams = Record<string, string | number>;

export type TemplateDefinition = {
  channels: NotificationChannel[];
  email?: (params: NotificationParams) => { subject: string; text: string };
};

export const NOTIFICATION_TEMPLATES = {
  'product.approved': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Your product "${p.productTitle}" was approved`,
      text: `Good news — "${p.productTitle}" passed review and is now live on DubaiPro.`
    })
  },
  'product.rejected': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Your product "${p.productTitle}" needs changes`,
      text: `"${p.productTitle}" was not approved.\nReason: ${p.reason ?? '-'}\nFix the issues and resubmit from your supplier panel.`
    })
  },
  /** Debounced: only fired when the recipient had no unread messages in the thread. */
  'message.new': {
    channels: ['inApp']
  },
  'sample.requested': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `New sample request for "${p.productTitle}"`,
      text: `${p.buyerName} requested a sample of "${p.productTitle}". Review it in your supplier panel.`
    })
  },
  'sample.status': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Sample request update: ${p.status}`,
      text: `Your sample request for "${p.productTitle}" is now ${p.status}.`
    })
  },
  'team.member.joined': {
    channels: ['inApp']
  },
  'broadcast.announcement': {
    channels: ['inApp']
  },
  'subscription.assigned': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Your DubaiPro plan is now ${p.planCode}`,
      text: `Your supplier subscription was changed to the ${p.planCode} plan${
        p.periodEnd && p.periodEnd !== '-' ? ` (valid until ${p.periodEnd})` : ''
      }.`
    })
  },
  'subscription.expiring': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Your ${p.planCode} plan expires on ${p.periodEnd}`,
      text: `Your ${p.planCode} subscription ends on ${p.periodEnd}. Renew it to keep your current limits — otherwise your account moves to the FREE plan.`
    })
  },
  'subscription.expired': {
    channels: ['inApp', 'email'],
    email: (p) => ({
      subject: `Your ${p.planCode} plan has expired`,
      text: `Your ${p.planCode} subscription expired and your account moved to the FREE plan. Existing products stay visible; new creations follow the FREE limits.`
    })
  }
} as const satisfies Record<string, TemplateDefinition>;

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES;

export function getTemplate(key: NotificationTemplateKey): TemplateDefinition {
  return NOTIFICATION_TEMPLATES[key];
}

/** i18n key fragment for a template ("product.approved" → "product_approved"). */
export function templateToMessageKey(templateKey: string): string {
  return templateKey.replace(/\./g, '_');
}
