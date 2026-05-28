import { NextResponse } from 'next/server';

import { listMethodsForCountry } from '@/lib/shipping/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

// GET /api/shipping/methods?country=AE  →  active methods for country.
// Public — used by checkout to filter options client-side.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') || '';
  if (!country) {
    return NextResponse.json(
      { error: 'country_required' },
      { status: 400 }
    );
  }
  try {
    const data = await listMethodsForCountry(country);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/shipping/methods failed:', err);
    return serverError();
  }
}
