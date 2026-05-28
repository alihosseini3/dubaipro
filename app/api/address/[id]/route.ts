import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import {
  AddressError,
  deleteAddressForUser,
  updateAddressForUser
} from '@/lib/address/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { AddressInput } from '@/types/address';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function toErrorResponse(err: unknown) {
  if (err instanceof AddressError) {
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.status }
    );
  }
  console.error('address route error:', err);
  return serverError();
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  const parsed = await parseJsonBody<AddressInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await updateAddressForUser(user.id, id, parsed.data);
    return NextResponse.json({ data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    await deleteAddressForUser(user.id, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
