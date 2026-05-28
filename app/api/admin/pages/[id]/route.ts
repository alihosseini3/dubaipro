import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { deletePage, getPageById, updatePage } from '@/lib/pages/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const page = await getPageById(id);
    if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ data: page });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/pages/[id]');
  }
}

type UpdateBody = {
  title?: unknown;
  slug?: unknown;
  body?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  isActive?: unknown;
  status?: unknown;
  locale?: unknown;
  order?: unknown;
};

export async function PUT(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const {
    title,
    slug,
    body,
    metaTitle,
    metaDescription,
    isActive,
    status,
    locale,
    order,
  } = parsed.data;

  try {
    const page = await updatePage(id, {
      title: typeof title === 'string' ? title : undefined,
      slug: typeof slug === 'string' ? slug : undefined,
      body: typeof body === 'string' ? body : undefined,
      metaTitle:
        typeof metaTitle === 'string'
          ? metaTitle
          : metaTitle === null
            ? null
            : undefined,
      metaDescription:
        typeof metaDescription === 'string'
          ? metaDescription
          : metaDescription === null
            ? null
            : undefined,
      isActive: typeof isActive === 'boolean' ? isActive : undefined,
      status:
        status === 'PUBLISHED' || status === 'DRAFT' ? status : undefined,
      locale: typeof locale === 'string' ? locale : undefined,
      order: typeof order === 'number' ? order : undefined,
    });
    return NextResponse.json({ data: page });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/pages/[id]');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await deletePage(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/pages/[id]');
  }
}
