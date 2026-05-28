import { NextResponse } from 'next/server';

import { serverError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getCampaign, sendCampaign } from '@/lib/marketing/campaigns';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/campaigns/[id]/send
 *
 * Kicks off the broadcast for a DRAFT or SCHEDULED campaign.
 * Runs inline — for very large lists (>50k) this should be moved to
 * a background job, but works fine for typical SMB audience sizes.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const result = await sendCampaign(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('POST /api/admin/marketing/campaigns/[id]/send failed:', err);
    return serverError();
  }
}
