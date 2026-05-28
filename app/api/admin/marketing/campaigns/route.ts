import { NextResponse } from 'next/server';
import { CampaignChannel, CampaignStatus, CustomerSegment } from '@prisma/client';

import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { createCampaign, listCampaigns } from '@/lib/marketing/campaigns';

export const runtime = 'nodejs';

const VALID_CHANNELS = new Set(Object.values(CampaignChannel));
const VALID_STATUSES = new Set(Object.values(CampaignStatus));
const VALID_SEGMENTS = new Set(Object.values(CustomerSegment));

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  try {
    const result = await listCampaigns({
      status: status && VALID_STATUSES.has(status as CampaignStatus)
        ? (status as CampaignStatus)
        : undefined,
      channel: channel && VALID_CHANNELS.has(channel as CampaignChannel)
        ? (channel as CampaignChannel)
        : undefined,
      page: isNaN(page) ? 1 : page,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/admin/marketing/campaigns failed:', err);
    return serverError();
  }
}

type CreateBody = {
  name?: unknown;
  channel?: unknown;
  subject?: unknown;
  body?: unknown;
  segment?: unknown;
  couponCode?: unknown;
  scheduledAt?: unknown;
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const b = parsed.data;

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    return badRequest('name is required');
  }
  if (typeof b.channel !== 'string' || !VALID_CHANNELS.has(b.channel as CampaignChannel)) {
    return badRequest('invalid channel');
  }
  if (typeof b.body !== 'string' || b.body.trim().length === 0) {
    return badRequest('body is required');
  }
  if (b.channel === CampaignChannel.EMAIL && (typeof b.subject !== 'string' || !b.subject.trim())) {
    return badRequest('subject required for email campaigns');
  }

  const segment =
    b.segment && VALID_SEGMENTS.has(b.segment as CustomerSegment)
      ? (b.segment as CustomerSegment)
      : null;

  const scheduledAt =
    b.scheduledAt && typeof b.scheduledAt === 'string'
      ? new Date(b.scheduledAt)
      : null;

  try {
    const campaign = await createCampaign({
      name: (b.name as string).trim(),
      channel: b.channel as CampaignChannel,
      subject: typeof b.subject === 'string' ? b.subject.trim() : null,
      body: (b.body as string).trim(),
      segment,
      couponCode: typeof b.couponCode === 'string' ? b.couponCode.trim() || null : null,
      scheduledAt,
      createdBy: admin.id,
    });
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/marketing/campaigns failed:', err);
    return serverError();
  }
}
