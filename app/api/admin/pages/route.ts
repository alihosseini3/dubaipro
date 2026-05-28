import { NextRequest, NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { createPage, listPages } from '@/lib/pages/service';
import type { PageStatus } from '@/lib/pages/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') as PageStatus | null;
  const locale = sp.get('locale') ?? undefined;
  const search = sp.get('search') ?? undefined;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = parseInt(sp.get('limit') ?? '20', 10);

  try {
    const result = await listPages({
      status: status ?? undefined,
      locale,
      search,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : Math.min(limit, 100),
    });
    return NextResponse.json(result);
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/pages');
  }
}

type CreateBody = {
  title?: unknown;
  slug?: unknown;
  body?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  status?: unknown;
  locale?: unknown;
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { title, slug, body, metaTitle, metaDescription, status, locale } =
    parsed.data;

  if (!isNonEmptyString(title)) return badRequest('title is required');

  try {
    const page = await createPage({
      title,
      slug: typeof slug === 'string' ? slug : undefined,
      body: typeof body === 'string' ? body : undefined,
      metaTitle: typeof metaTitle === 'string' ? metaTitle : null,
      metaDescription:
        typeof metaDescription === 'string' ? metaDescription : null,
      status:
        status === 'PUBLISHED' || status === 'DRAFT'
          ? status
          : 'DRAFT',
      locale: typeof locale === 'string' ? locale : '',
    });
    return NextResponse.json({ data: page }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/pages');
  }
}
