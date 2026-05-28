import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  ShippingError,
  createShippingMethod,
  listAllShippingMethods
} from '@/lib/shipping/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { ShippingMethodInput } from '@/types/shipping';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const data = await listAllShippingMethods();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/admin/shipping failed:', err);
    return serverError();
  }
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = await parseJsonBody<ShippingMethodInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await createShippingMethod(parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('POST /api/admin/shipping failed:', err);
    return serverError();
  }
}
