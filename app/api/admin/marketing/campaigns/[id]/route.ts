import { NextResponse } from 'next/server';
import { CampaignChannel, CampaignStatus, CustomerSegment } from '@prisma/client';

import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { deleteCampaign, getCampaign, updateCampaign } from '@/lib/marketing/campaigns';

export const runtime = 'nodejs';

const VALID_CHANNELS = new Set(Object.values(CampaignChannel));
const VALID_SEGMENTS = new Set(Object.values(CustomerSegment));

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ data: campaign });
}

type PatchBody = {
  name?: unknown;
  channel?: unknown;
  subject?: unknown;
  body?: unknown;
  segment?: unknown;
  couponCode?: unknown;
  scheduledAt?: unknown;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;

  const existing = await getCampaign(id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (
    existing.status === CampaignStatus.SENDING ||
    existing.status === CampaignStatus.COMPLETED
  ) {
    return NextResponse.json({ error: 'campaign_immutable' }, { status: 409 });
  }

  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const b = parsed.data;

  try {
    const updated = await updateCampaign(id, {
      ...(typeof b.name === 'string' ? { name: b.name.trim() } : {}),
      ...(typeof b.channel === 'string' && VALID_CHANNELS.has(b.channel as CampaignChannel)
        ? { channel: b.channel as CampaignChannel }
        : {}),
      ...(typeof b.subject === 'string' ? { subject: b.subject.trim() || null } : {}),
      ...(typeof b.body === 'string' ? { body: b.body.trim() } : {}),
      ...(b.segment === null
        ? { segment: null }
        : typeof b.segment === 'string' && VALID_SEGMENTS.has(b.segment as CustomerSegment)
          ? { segment: b.segment as CustomerSegment }
          : {}),
      ...(b.couponCode === null
        ? { couponCode: null }
        : typeof b.couponCode === 'string'
          ? { couponCode: b.couponCode.trim() || null }
          : {}),
      ...(b.scheduledAt === null
        ? { scheduledAt: null }
        : typeof b.scheduledAt === 'string'
          ? { scheduledAt: new Date(b.scheduledAt) }
          : {}),
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('PATCH /api/admin/marketing/campaigns/[id] failed:', err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const existing = await getCampaign(id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.status === CampaignStatus.SENDING) {
    return NextResponse.json({ error: 'cannot_delete_sending' }, { status: 409 });
  }
  try {
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/marketing/campaigns/[id] failed:', err);
    return serverError();
  }
}
