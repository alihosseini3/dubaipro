import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getPageSeo, upsertPageSeo } from '@/lib/pages/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const data = await getPageSeo(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/pages/[id]/seo');
  }
}

type SeoBody = {
  ogImage?: unknown;
  canonicalUrl?: unknown;
  robots?: unknown;
  structuredData?: unknown;
};

export async function PUT(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = await parseJsonBody<SeoBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { ogImage, canonicalUrl, robots, structuredData } = parsed.data;

  try {
    const data = await upsertPageSeo(id, {
      ogImage: typeof ogImage === 'string' ? ogImage : null,
      canonicalUrl: typeof canonicalUrl === 'string' ? canonicalUrl : null,
      robots: typeof robots === 'string' ? robots : null,
      structuredData:
        structuredData != null && typeof structuredData === 'object'
          ? (structuredData as Record<string, unknown>)
          : null,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/pages/[id]/seo');
  }
}
