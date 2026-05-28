import { NextResponse } from 'next/server';
import { CustomerSegment } from '@prisma/client';

import { serverError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getSegmentStats, sampleSegment } from '@/lib/marketing/segments';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get('preview');

  try {
    if (preview) {
      const seg = Object.values(CustomerSegment).includes(preview as CustomerSegment)
        ? (preview as CustomerSegment)
        : null;
      const sample = await sampleSegment(seg);
      return NextResponse.json({ data: sample });
    }

    const stats = await getSegmentStats();
    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error('GET /api/admin/marketing/segments failed:', err);
    return serverError();
  }
}
