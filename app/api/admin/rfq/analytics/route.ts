import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getRfqAnalytics, getRfqQuickStats } from '@/lib/analytics/rfq-analytics';

export const runtime = 'nodejs';

/** Helper to parse date range */
function parseRange(preset: string, fromStr?: string | null, toStr?: string | null) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  switch (preset) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() + 1);
      to.setHours(0, 0, 0, 0);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
    default:
      from.setDate(from.getDate() - 30);
      break;
    case 'custom':
      if (fromStr) from.setTime(Date.parse(fromStr));
      if (toStr) to.setTime(Date.parse(toStr));
      break;
  }

  return { from, to, preset };
}

/** GET /api/admin/rfq/analytics — RFQ analytics for admin dashboard */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get('preset') as 'today' | '7d' | '30d' | 'custom') || '30d';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  try {
    const range = parseRange(preset, fromParam, toParam);
    const data = await getRfqAnalytics(range.from, range.to);

    return NextResponse.json({
      data,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        preset: range.preset,
      },
    });
  } catch (error) {
    console.error('[rfq-analytics]', error);
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
