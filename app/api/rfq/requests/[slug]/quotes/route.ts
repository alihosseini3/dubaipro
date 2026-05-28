import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { submitQuote } from '@/lib/rfq/quotes';
import { getRfqBySlug } from '@/lib/rfq/service';
import type { SubmitQuoteInput } from '@/lib/rfq/types';

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
    return NextResponse.json({ data: rfq.quotes });
  } catch (error) {
    return handlePrismaError(error, `GET /api/rfq/requests/${slug}/quotes`);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'SUPPLIER' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'only suppliers can submit quotes' }, { status: 403 });
  }

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  });
  if (!supplier || supplier.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'supplier_not_active' }, { status: 403 });
  }

  const parsed = await parseJsonBody<SubmitQuoteInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!body.price || body.price <= 0) return badRequest('price must be positive');
  if (!body.currency) return badRequest('currency is required');

  try {
    const rfq = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!rfq) return notFound('RFQ not found');

    const result = await submitQuote(rfq.id, supplier.id, body);
    if (!result.ok) return badRequest(result.error ?? 'failed');
    return NextResponse.json({ data: result.quote }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, `POST /api/rfq/requests/${slug}/quotes`);
  }
}
