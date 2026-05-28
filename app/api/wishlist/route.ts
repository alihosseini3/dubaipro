import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { listWishlistItems } from '@/lib/wishlist/service';
import { handlePrismaError } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const items = await listWishlistItems(user.id);
    return NextResponse.json({ data: items });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/wishlist');
  }
}
