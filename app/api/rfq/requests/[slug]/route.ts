import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { cancelRfq, getRfqBySlug, updateRfq } from '@/lib/rfq/service';
import type { UpdateRfqInput } from '@/lib/rfq/types';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const user = await getCurrentUser();
    const rfq = await getRfqBySlug(slug, user?.id, user?.role === 'ADMIN');
    if (!rfq) return notFound('RFQ not found');
    return NextResponse.json({ data: rfq });
  } catch (error) {
    return handlePrismaError(error, `GET /api/rfq/requests/${slug}`);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<UpdateRfqInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const existing = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!existing) return notFound('RFQ not found');

    const updated = await updateRfq(existing.id, user.id, parsed.data, user.role === 'ADMIN');
    if (!updated) return notFound('RFQ not found or forbidden');
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/rfq/requests/${slug}`);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const existing = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!existing) return notFound('RFQ not found');

    const ok = await cancelRfq(existing.id, user.id, user.role === 'ADMIN');
    if (!ok) return notFound('RFQ not found or forbidden');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/rfq/requests/${slug}`);
  }
}
