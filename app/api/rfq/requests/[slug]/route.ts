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

  const parsed = await parseJsonBody<UpdateRfqInput & { whatsapp?: string; email?: string; attachmentIds?: string[]; attachmentsModified?: boolean }>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  // Map the wizard's contact fields (whatsapp/email) onto the stored
  // columns, with the same validation as creation.
  const { whatsapp, email, attachmentIds, attachmentsModified, ...rest } = body;
  const update: UpdateRfqInput & { attachmentIds?: string[]; attachmentsModified?: boolean } = { ...rest };
  if (whatsapp !== undefined) {
    const normalized = whatsapp.trim().replace(/[\s\-().]/g, '');
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return badRequest('a valid WhatsApp number with country code is required');
    }
    update.contactWhatsapp = normalized;
  }
  if (email !== undefined) {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return badRequest('contactEmail is invalid');
    }
    update.contactEmail = trimmed || undefined;
  }
  if (attachmentIds !== undefined) {
    update.attachmentIds = attachmentIds;
    update.attachmentsModified = attachmentsModified;
  }

  try {
    const existing = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!existing) return notFound('RFQ not found');

    const updated = await updateRfq(existing.id, user.id, update, user.role === 'ADMIN');
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
