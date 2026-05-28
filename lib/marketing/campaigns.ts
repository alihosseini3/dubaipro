/**
 * Campaign service — create, update, query, send.
 *
 * Send logic runs inline (no external queue needed for <10k lists),
 * but wraps each message in a per-recipient try/catch so a single
 * failure never aborts the whole broadcast.  Status counters are
 * updated atomically at the end of the run.
 */

import {
  CampaignChannel,
  CampaignStatus,
  CustomerSegment,
  Prisma,
} from '@prisma/client';

import { sendEmail } from '@/lib/email/service';
import { interpolate } from '@/lib/automation/interpolate';
import { prisma } from '@/lib/prisma';
import { getSiteUrl } from '@/lib/seo/site';
import { sendWhatsAppMessage } from '@/lib/automation/whatsapp-send';

/* ─── Types ───────────────────────────────────────────────────────────── */

export type CampaignRow = {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  subject: string | null;
  body: string;
  segment: CustomerSegment | null;
  couponCode: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCampaignInput = {
  name: string;
  channel: CampaignChannel;
  subject?: string | null;
  body: string;
  segment?: CustomerSegment | null;
  couponCode?: string | null;
  scheduledAt?: Date | null;
  createdBy: string;
};

export type UpdateCampaignInput = Partial<
  Omit<CreateCampaignInput, 'createdBy'>
>;

export type SendResult = {
  ok: boolean;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  error?: string;
};

/* ─── CRUD ─────────────────────────────────────────────────────────────── */

export async function listCampaigns(opts?: {
  status?: CampaignStatus;
  channel?: CampaignChannel;
  page?: number;
  pageSize?: number;
}): Promise<{ campaigns: CampaignRow[]; total: number }> {
  const { status, channel, page = 1, pageSize = 20 } = opts ?? {};
  const where: Prisma.CampaignWhereInput = {
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
  };
  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaign.count({ where }),
  ]);
  return { campaigns, total };
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  return prisma.campaign.findUnique({ where: { id } });
}

export async function createCampaign(
  input: CreateCampaignInput,
): Promise<CampaignRow> {
  return prisma.campaign.create({
    data: {
      name: input.name,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      segment: input.segment ?? null,
      couponCode: input.couponCode ?? null,
      scheduledAt: input.scheduledAt ?? null,
      createdBy: input.createdBy,
    },
  });
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
): Promise<CampaignRow> {
  return prisma.campaign.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.segment !== undefined ? { segment: patch.segment } : {}),
      ...(patch.couponCode !== undefined ? { couponCode: patch.couponCode } : {}),
      ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
    },
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await prisma.campaign.delete({ where: { id } });
}

/* ─── Recipient resolution ─────────────────────────────────────────────── */

type Recipient = {
  userId: string | null;
  email: string | null;
  phone: string | null;
  name: string;
};

async function resolveRecipients(
  channel: CampaignChannel,
  segment: CustomerSegment | null,
): Promise<Recipient[]> {
  const segmentWhere = segment ? { metrics: { segment } } : {};

  if (channel === CampaignChannel.EMAIL) {
    const users = await prisma.user.findMany({
      where: { ...segmentWhere, email: { not: '' } },
      select: { id: true, name: true, email: true },
      take: 10_000,
    });
    return users.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: null,
    }));
  }

  // WhatsApp: use default address phone per user.
  const users = await prisma.user.findMany({
    where: {
      ...segmentWhere,
      addresses: { some: { phone: { not: '' } } },
    },
    select: {
      id: true,
      name: true,
      addresses: {
        where: { isDefault: true },
        select: { phone: true },
        take: 1,
      },
    },
    take: 10_000,
  });

  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: null,
      phone: u.addresses[0]?.phone ?? null,
    }))
    .filter((r) => r.phone);
}

/* ─── Send ─────────────────────────────────────────────────────────────── */

/**
 * Sends the campaign to all resolved recipients.
 * Updates campaign status + counters on completion.
 * Non-blocking failures per recipient — never throws.
 */
export async function sendCampaign(campaignId: string): Promise<SendResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) return { ok: false, totalRecipients: 0, totalSent: 0, totalFailed: 0, error: 'not_found' };
  if (campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.COMPLETED) {
    return { ok: false, totalRecipients: 0, totalSent: 0, totalFailed: 0, error: 'already_sent' };
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.SENDING },
  });

  const recipients = await resolveRecipients(campaign.channel, campaign.segment);

  // Bulk-insert recipient rows (ignore existing for idempotency).
  if (recipients.length > 0) {
    await prisma.campaignRecipient.createMany({
      data: recipients.map((r) => ({
        campaignId,
        userId: r.userId,
        email: r.email,
        phone: r.phone,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { totalRecipients: recipients.length },
  });

  const base = getSiteUrl();
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const trackOpen = `${base}/api/marketing/track/open?cid=${campaignId}&uid=${r.userId ?? ''}`;
    const trackClick = `${base}/api/marketing/track/click?cid=${campaignId}&uid=${r.userId ?? ''}&url=${encodeURIComponent(base)}`;

    const vars = {
      name: r.name,
      product: '',
      price: '',
      link: trackClick,
      couponCode: campaign.couponCode ?? '',
    };

    const renderedSubject = campaign.subject
      ? interpolate(campaign.subject, vars)
      : undefined;

    // Embed tracking pixel in email body.
    const pixel = campaign.channel === CampaignChannel.EMAIL
      ? `<img src="${trackOpen}" width="1" height="1" style="display:none" alt="">`
      : '';

    const renderedBody = interpolate(campaign.body, vars) + pixel;

    try {
      let result: { success: boolean; error?: string };

      if (campaign.channel === CampaignChannel.EMAIL && r.email) {
        result = await sendEmail({
          to: r.email,
          subject: renderedSubject ?? campaign.name,
          html: renderedBody,
        });
      } else if (campaign.channel === CampaignChannel.WHATSAPP && r.phone) {
        result = await sendWhatsAppMessage({ to: r.phone, body: renderedBody });
      } else {
        result = { success: false, error: 'no_contact' };
      }

      const newStatus = result.success ? 'SENT' : 'FAILED';
      await prisma.campaignRecipient.updateMany({
        where: {
          campaignId,
          ...(r.email ? { email: r.email } : { phone: r.phone }),
        },
        data: {
          status: newStatus,
          sentAt: result.success ? new Date() : undefined,
          error: result.error ?? null,
        },
      });

      result.success ? sent++ : failed++;
    } catch (err) {
      failed++;
      console.error('[campaign] recipient send error', err);
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.COMPLETED,
      sentAt: new Date(),
      totalSent: sent,
      totalFailed: failed,
    },
  });

  return { ok: true, totalRecipients: recipients.length, totalSent: sent, totalFailed: failed };
}
