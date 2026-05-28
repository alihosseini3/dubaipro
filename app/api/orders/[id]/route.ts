import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: { id: true, title: true, slug: true, imageUrl: true }
            }
          }
        }
      }
    });
    if (!order) return notFound('Order not found');
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ data: order });
  } catch (error) {
    return handlePrismaError(error, `GET /api/orders/${id}`);
  }
}

type PatchBody = {
  status?: unknown;
  trackingCode?: unknown;
  carrier?: unknown;
};

/**
 * PATCH /api/orders/[id]
 *
 * Admin-only. Updates the order status and optional tracking fields.
 * Line items and totals remain immutable snapshots.
 *
 * `trackingCode` / `carrier` accept `null` explicitly to clear, or a
 * non-empty trimmed string up to 64 chars (matches schema).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await context.params;

  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const data: {
    status?: (typeof ORDER_STATUSES)[number];
    trackingCode?: string | null;
    carrier?: string | null;
  } = {};

  if (body.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !(ORDER_STATUSES as readonly string[]).includes(body.status)
    ) {
      return badRequest('invalid status');
    }
    data.status = body.status as (typeof ORDER_STATUSES)[number];
  }

  for (const key of ['trackingCode', 'carrier'] as const) {
    const v = body[key];
    if (v === undefined) continue;
    if (v === null || v === '') {
      data[key] = null;
      continue;
    }
    if (typeof v !== 'string' || v.length > 64) {
      return badRequest(`invalid ${key}`);
    }
    data[key] = v.trim();
  }

  if (Object.keys(data).length === 0) {
    return badRequest('No fields to update');
  }

  try {
    const order = await prisma.order.update({ where: { id }, data });
    return NextResponse.json({ data: order });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/orders/${id}`);
  }
}
