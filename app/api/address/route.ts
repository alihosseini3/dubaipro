import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import {
  AddressError,
  createAddressForUser,
  listAddressesForUser
} from '@/lib/address/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { AddressInput } from '@/types/address';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const data = await listAddressesForUser(user.id);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/address failed:', err);
    return serverError();
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<AddressInput>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await createAddressForUser(user.id, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof AddressError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('POST /api/address failed:', err);
    return serverError();
  }
}
