import { NextRequest, NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getAnalytics, parseRange } from '@/lib/analytics/service';

/**
 * GET /api/admin/analytics?preset=today|7d|30d|custom&from=ISO&to=ISO
 *
 * ADMIN-only. All monetary values in the response are **AED**. The client
 * is expected to convert to the display currency itself.
 *
 * Cached with a short TTL (60s) to protect the DB against rapid
 * range-switching clicks in the dashboard — true freshness is not critical
 * for analytics, and 60s is well within the "effectively live" band.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = parseRange({
    preset: searchParams.get('preset'),
    from: searchParams.get('from'),
    to: searchParams.get('to')
  });

  const data = await getAnalytics(range);

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=30'
    }
  });
}
