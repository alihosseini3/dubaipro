import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  ShippingError,
  deleteShippingZone,
  getShippingZone,
  updateShippingZone
} from '@/lib/shipping/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { ShippingZoneInput } from '@/types/shipping';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  try {
    const data = await getShippingZone(id);
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET zone failed:', err);
    return serverError();
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const parsed = await parseJsonBody<Partial<ShippingZoneInput>>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  try {
    const data = await updateShippingZone(id, parsed.data);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('PUT zone failed:', err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  try {
    await deleteShippingZone(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('DELETE zone failed:', err);
    return serverError();
  }
}
