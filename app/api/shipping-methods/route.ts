import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { listActiveShippingMethods } from '@/lib/shipping/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/shipping-methods
 *
 * Returns only active methods. Requires auth to avoid exposing the
 * shipping catalogue publicly (it's not secret, but it's not useful
 * without a checkout context either).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const data = await listActiveShippingMethods();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/shipping-methods failed:', err);
    return serverError();
  }
}
