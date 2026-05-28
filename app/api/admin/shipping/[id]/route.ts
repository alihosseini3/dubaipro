import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  ShippingError,
  deleteShippingMethod,
  updateShippingMethod
} from '@/lib/shipping/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { ShippingMethodInput } from '@/types/shipping';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const parsed = await parseJsonBody<Partial<ShippingMethodInput>>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await updateShippingMethod(id, parsed.data);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('PATCH /api/admin/shipping/[id] failed:', err);
    return serverError();
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    await deleteShippingMethod(id);
    return NextResponse.json({ data: { id } });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('DELETE /api/admin/shipping/[id] failed:', err);
    return serverError();
  }
}
