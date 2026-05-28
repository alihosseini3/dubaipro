import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { searchSuggestions } from '@/lib/search/service';

export const runtime = 'nodejs';

/**
 * Public, unauthenticated autocomplete endpoint.
 *
 *   GET /api/search?q=<term>
 *
 * Cheap by design: returns at most 10 product + 5 brand + 5 category
 * suggestions. Always 200 OK with empty arrays on a missing/blank
 * query — keeps the client logic branch-free.
 *
 * `Cache-Control` is set to a short SWR window so repeated keystrokes
 * across users (e.g. "shoes") hit the CDN, not the database. Per-user
 * personalisation is not part of this surface.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  try {
    const data = await searchSuggestions(q);
    return NextResponse.json(data, {
      headers: {
        // 30s fresh, then serve-stale-while-revalidate for 5min.
        'Cache-Control':
          'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/search');
  }
}
