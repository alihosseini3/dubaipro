import {
  AutomationChannel,
  AutomationEventType,
  AutomationStatus,
  CustomerSegment,
  Prisma
} from '@prisma/client';

import { sendEmail } from '@/lib/email/service';
import { prisma } from '@/lib/prisma';

import { interpolate, type TemplateVars } from './interpolate';
import { getDefaultTemplate } from './templates';
import { sendWhatsAppMessage } from './whatsapp-send';

/**
 * Single entry point used by the rest of the app. Side effects:
 *  1. Looks up the rule for (event, channel, locale).
 *  2. Skips if disabled / rate-limited / already sent (dedupeKey).
 *  3. Renders template + sends via the appropriate channel.
 *  4. Always records an AutomationLog row (audit + dedup).
 *
 * Errors are caught and logged — never thrown — because we don't want
 * marketing automation to break the user-facing critical path (signup,
 * checkout, etc.) when SMTP/WhatsApp is misconfigured.
 */

export type DispatchInput = {
  eventType: AutomationEventType;
  userId?: string | null;
  /** Used for dedup. e.g. "ORDER_CREATED:<orderId>". */
  dedupeKey?: string;
  /** Locale code (en/fa/ar/ur). Falls back to 'en'. */
  locale?: string;
  /**
   * Optional explicit segment override. If omitted we resolve from
   * `UserMetrics.segment` for the given userId, falling back to `ALL`.
   */
  segment?: CustomerSegment;
  /** Per-channel recipients. If absent we skip that channel. */
  email?: string;
  whatsappPhone?: string;
  vars: TemplateVars;
};

const DEFAULT_LOCALE = 'en';

/** Anti-spam: max sends per user per channel per hour. */
const RATE_LIMIT_PER_HOUR = 5;

/**
 * Promotional events. The 24h throttle counts only these; transactional
 * events (order receipts, payment confirmations) bypass the throttle.
 */
const PROMO_EVENTS: ReadonlySet<AutomationEventType> = new Set([
  AutomationEventType.FIRST_PURCHASE_UPSELL,
  AutomationEventType.POST_PURCHASE_REMINDER,
  AutomationEventType.INACTIVE_COMEBACK
]);

/**
 * Resolve the effective segment for a dispatch. Accepts explicit
 * override, otherwise reads `UserMetrics.segment`, otherwise `ALL`.
 */
async function resolveSegment(
  input: DispatchInput
): Promise<CustomerSegment> {
  if (input.segment) return input.segment;
  if (!input.userId) return CustomerSegment.ALL;
  const metrics = await prisma.userMetrics
    .findUnique({
      where: { userId: input.userId },
      select: { segment: true }
    })
    .catch(() => null);
  return metrics?.segment ?? CustomerSegment.ALL;
}

export async function dispatchAutomation(input: DispatchInput): Promise<void> {
  const channels: AutomationChannel[] = [];
  if (input.email) channels.push(AutomationChannel.EMAIL);
  if (input.whatsappPhone) channels.push(AutomationChannel.WHATSAPP);
  if (channels.length === 0) return;

  for (const channel of channels) {
    try {
      await dispatchOne(input, channel);
    } catch (err) {
      // Last-ditch safety net — never bubble up.
      // eslint-disable-next-line no-console
      console.error('[automation] dispatch failed', err);
    }
  }
}

async function dispatchOne(input: DispatchInput, channel: AutomationChannel) {
  const locale = input.locale || DEFAULT_LOCALE;
  const recipient =
    channel === AutomationChannel.EMAIL ? input.email : input.whatsappPhone;
  if (!recipient) return;

  // ---- Idempotency: bail before doing any work if we've already sent
  if (input.dedupeKey) {
    const existing = await prisma.automationLog.findUnique({
      where: {
        dedupeKey_channel_eventType: {
          dedupeKey: input.dedupeKey,
          channel,
          eventType: input.eventType
        }
      },
      select: { id: true, status: true }
    });
    // SENT or SKIPPED → don't retry. FAILED is also not retried by
    // dispatch — retries should be intentional (cron / admin action).
    if (existing) return;
  }

  // ---- Rate limit (per user + channel + hour)
  if (input.userId) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.automationLog.count({
      where: {
        userId: input.userId,
        channel,
        createdAt: { gte: since },
        status: AutomationStatus.SENT
      }
    });
    if (recent >= RATE_LIMIT_PER_HOUR) {
      await safeLog(input, channel, recipient, AutomationStatus.SKIPPED, 'rate_limited');
      return;
    }
  }

  // ---- Promo throttle: max 1 promotional message per user per 24h.
  // Transactional events (order receipts, etc.) are exempt — those
  // are expected and never feel like marketing.
  if (input.userId && PROMO_EVENTS.has(input.eventType)) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPromo = await prisma.automationLog.count({
      where: {
        userId: input.userId,
        eventType: { in: Array.from(PROMO_EVENTS) },
        status: AutomationStatus.SENT,
        createdAt: { gte: since }
      }
    });
    if (recentPromo >= 1) {
      await safeLog(input, channel, recipient, AutomationStatus.SKIPPED, 'promo_throttled_24h');
      return;
    }
  }

  // ---- Resolve segment + rule (segment-specific → ALL → seed default)
  const segment = await resolveSegment(input);

  let rule = await prisma.automationRule.findUnique({
    where: {
      eventType_channel_locale_segment: {
        eventType: input.eventType,
        channel,
        locale,
        segment
      }
    }
  });
  if (!rule && segment !== CustomerSegment.ALL) {
    rule = await prisma.automationRule.findUnique({
      where: {
        eventType_channel_locale_segment: {
          eventType: input.eventType,
          channel,
          locale,
          segment: CustomerSegment.ALL
        }
      }
    });
  }

  let subject: string | undefined;
  let body: string;

  if (rule) {
    if (!rule.enabled) {
      await safeLog(input, channel, recipient, AutomationStatus.SKIPPED, 'disabled');
      return;
    }
    subject = rule.subject ?? undefined;
    body = rule.body;
  } else {
    const seed = getDefaultTemplate(input.eventType, channel, locale, segment);
    if (!seed) {
      await safeLog(input, channel, recipient, AutomationStatus.SKIPPED, 'no_template');
      return;
    }
    subject = seed.subject;
    body = seed.body;
  }

  const renderedSubject = subject ? interpolate(subject, input.vars) : undefined;
  const renderedBody = interpolate(body, input.vars);

  // ---- Send
  let result: { success: boolean; error?: string };
  if (channel === AutomationChannel.EMAIL) {
    result = await sendEmail({
      to: recipient,
      subject: renderedSubject ?? 'Notification',
      html: renderedBody
    });
  } else {
    result = await sendWhatsAppMessage({ to: recipient, body: renderedBody });
  }

  await safeLog(
    input,
    channel,
    recipient,
    result.success ? AutomationStatus.SENT : AutomationStatus.FAILED,
    result.error
  );
}

async function safeLog(
  input: DispatchInput,
  channel: AutomationChannel,
  recipient: string,
  status: AutomationStatus,
  error?: string
) {
  try {
    await prisma.automationLog.create({
      data: {
        userId: input.userId ?? null,
        eventType: input.eventType,
        channel,
        status,
        recipient: recipient.slice(0, 255),
        dedupeKey: input.dedupeKey ?? null,
        error: error ? error.slice(0, 1000) : null,
        payload: input.vars as Prisma.InputJsonValue
      }
    });
  } catch (e) {
    // Unique violation on dedupeKey is benign — means a parallel call
    // already logged this send. Anything else we surface to console.
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    ) {
      // eslint-disable-next-line no-console
      console.error('[automation] log failed', e);
    }
  }
}
