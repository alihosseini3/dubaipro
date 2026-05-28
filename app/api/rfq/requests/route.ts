import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { createRfq, listRfqs } from '@/lib/rfq/service';
import type { CreateRfqInput, RfqListFilters } from '@/lib/rfq/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sp = url.searchParams;

    const filters: RfqListFilters = {
      page: Math.max(1, Number(sp.get('page')) || 1),
      limit: Math.min(50, Math.max(1, Number(sp.get('limit')) || 20)),
      search: sp.get('q') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
      shippingCountry: sp.get('country') ?? undefined,
      urgency: (sp.get('urgency') as RfqListFilters['urgency']) ?? undefined,
      status: (sp.get('status') as RfqListFilters['status']) ?? undefined,
    };

    const user = await getCurrentUser();
    const { items, total } = await listRfqs(filters, user?.id, user?.role === 'ADMIN');
    const limit = filters.limit ?? 20;
    return NextResponse.json({
      data: items,
      meta: { total, page: filters.page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/rfq/requests');
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateRfqInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!body.title?.trim()) return badRequest('title is required');
  if (!body.description?.trim()) return badRequest('description is required');
  if (!body.quantity || body.quantity < 1) return badRequest('quantity must be >= 1');
  if (!body.unit?.trim()) return badRequest('unit is required');
  if (!body.currency?.trim()) return badRequest('currency is required');
  if (!body.shippingCountry?.trim()) return badRequest('shippingCountry is required');

  try {
    const rfq = await createRfq(user.id, body);
    return NextResponse.json({ data: rfq }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/rfq/requests');
  }
}
