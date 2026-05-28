import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { reorderAttributes } from '@/lib/attributes/service';

export const runtime = 'nodejs';

/**
 * POST /api/admin/attributes/reorder
 * Body: { orders: Array<{ id: string, sortOrder: number }> }
 *
 * One transactional update — avoids the N-round-trip pattern in the old
 * up/down buttons (which could leave rows in a half-swapped state on
 * network failure).
 */
export async function POST(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body.orders;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'orders must be an array' }, { status: 422 });
  }

  const orders: Array<{ id: string; sortOrder: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, sortOrder } = item as { id?: unknown; sortOrder?: unknown };
    if (typeof id !== 'string' || !id) continue;
    if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) continue;
    orders.push({ id, sortOrder: Math.trunc(sortOrder) });
  }

  if (orders.length === 0) {
    return NextResponse.json({ error: 'no valid orders' }, { status: 422 });
  }

  await reorderAttributes(orders);
  return NextResponse.json({ ok: true, count: orders.length });
}
