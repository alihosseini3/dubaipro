import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getCartDTO } from '@/lib/cart/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const cart = await getCartDTO(user.id);
    return NextResponse.json({ data: cart });
  } catch (error) {
    console.error('GET /api/cart failed:', error);
    return serverError();
  }
}
