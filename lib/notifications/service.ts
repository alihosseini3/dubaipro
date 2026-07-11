import 'server-only';

import type { Prisma, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/service';
import { sendWhatsAppMessage } from '@/lib/automation/whatsapp-send';
import { memberHasPermission, type Permission } from '@/lib/auth/permissions';

import {
  getTemplate,
  type NotificationChannel,
  type NotificationParams,
  type NotificationTemplateKey
} from './registry';

/**
 * Notification fan-out.
 *
 * Contract:
 *   - `notify` NEVER throws — a notification failure must not break the
 *     business action that triggered it.
 *   - The in-app row is written first (source of truth); email/WhatsApp are
 *     dispatched fire-and-forget afterwards, each failure isolated and
 *     recorded in `Notification.channels`.
 *   - No queue infra yet — the interface is queue-shaped so a worker can
 *     replace inline dispatch later without touching call sites.
 */

export type NotifyOptions = {
  link?: string;
  /** Override the registry's default channels for this one notification. */
  channels?: NotificationChannel[];
};

export async function notify(
  userId: string,
  templateKey: NotificationTemplateKey,
  params: NotificationParams = {},
  options: NotifyOptions = {}
): Promise<void> {
  try {
    const template = getTemplate(templateKey);
    const channels = options.channels ?? template.channels;

    const row = await prisma.notification.create({
      data: {
        userId,
        templateKey,
        params,
        link: options.link ?? null,
        channels: { inApp: true }
      },
      select: { id: true }
    });

    // Side channels: fire-and-forget, isolated per channel.
    if (channels.includes('email') || channels.includes('whatsapp')) {
      void dispatchSideChannels(row.id, userId, templateKey, params, channels).catch(
        () => {}
      );
    }
  } catch (error) {
    console.error(`notify(${templateKey}) failed:`, error);
  }
}

export async function notifyMany(
  userIds: string[],
  templateKey: NotificationTemplateKey,
  params: NotificationParams = {},
  options: NotifyOptions = {}
): Promise<void> {
  await Promise.all(userIds.map((id) => notify(id, templateKey, params, options)));
}

async function dispatchSideChannels(
  notificationId: string,
  userId: string,
  templateKey: NotificationTemplateKey,
  params: NotificationParams,
  channels: NotificationChannel[]
) {
  const template = getTemplate(templateKey);
  const outcome: Record<string, unknown> = { inApp: true };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true }
  });

  if (channels.includes('email')) {
    if (user?.email && template.email) {
      const rendered = template.email(params);
      const result = await sendEmail({
        to: user.email,
        subject: rendered.subject,
        text: rendered.text,
        html: `<p>${escapeHtml(rendered.text).replace(/\n/g, '<br/>')}</p>`
      }).catch((err: Error) => ({ success: false, error: err.message }));
      outcome.email = result.success ? 'sent' : `failed: ${result.error ?? 'unknown'}`;
    } else {
      outcome.email = 'skipped';
    }
  }

  if (channels.includes('whatsapp')) {
    if (user?.phone && template.email) {
      const rendered = template.email(params);
      const result = await sendWhatsAppMessage({
        to: user.phone,
        body: `${rendered.subject}\n${rendered.text}`
      }).catch((err: Error) => ({ success: false, error: err.message }));
      outcome.whatsapp = result.success
        ? 'sent'
        : `failed: ${result.error ?? 'unknown'}`;
    } else {
      outcome.whatsapp = 'skipped';
    }
  }

  await prisma.notification
    .update({
      where: { id: notificationId },
      data: { channels: outcome as Prisma.InputJsonValue }
    })
    .catch(() => {});
}

/* ─── Reads / state ──────────────────────────────────────────────────────── */

export async function listNotifications(
  userId: string,
  options: { page: number; pageSize: number; unreadOnly?: boolean }
) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(options.unreadOnly ? { readAt: null } : {})
  };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        templateKey: true,
        params: true,
        link: true,
        readAt: true,
        createdAt: true
      }
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  return { items, total, unread };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() }
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
}

/* ─── Recipient helpers ──────────────────────────────────────────────────── */

/** Active org members whose role grants the given permission. */
export async function orgMemberIdsWithPermission(
  supplierId: string,
  permission: Permission
): Promise<string[]> {
  const members = await prisma.supplierMember.findMany({
    where: { supplierId, isActive: true },
    select: { userId: true, role: true, permissions: true }
  });
  return members
    .filter((m) => memberHasPermission(m.role, permission, m.permissions))
    .map((m) => m.userId);
}

/* ─── Admin broadcast ────────────────────────────────────────────────────── */

export type BroadcastAudience = 'ALL' | 'BUYERS' | 'SUPPLIERS';

/** Prisma where-clause for a broadcast audience (pure, exported for tests). */
export function audienceWhere(audience: BroadcastAudience): Prisma.UserWhereInput {
  if (audience === 'SUPPLIERS') return { role: 'SUPPLIER' as UserRole };
  if (audience === 'BUYERS') {
    return { role: { in: ['CUSTOMER', 'SELLER'] as UserRole[] } };
  }
  return {};
}

const BROADCAST_BATCH = 500;

/**
 * In-app announcement to an audience. Batched by cursor; returns the number
 * of recipients. In-app only by design — mass email belongs to the existing
 * marketing Campaign engine, not here.
 */
export async function broadcastAnnouncement(params: {
  audience: BroadcastAudience;
  message: string;
  link?: string;
}): Promise<number> {
  const where = audienceWhere(params.audience);
  let cursor: string | null = null;
  let count = 0;

  for (;;) {
    const users: { id: string }[] = await prisma.user.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BROADCAST_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        templateKey: 'broadcast.announcement',
        params: { message: params.message },
        link: params.link ?? null,
        channels: { inApp: true }
      }))
    });
    count += users.length;
    if (users.length < BROADCAST_BATCH) break;
  }
  return count;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
