import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import {
  deleteNavigationItem,
  updateNavigationItem
} from '@/lib/header/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type UpdateBody = {
  label?: unknown;
  href?: unknown;
  type?: unknown;
  pageId?: unknown;
  isActive?: unknown;
  order?: unknown;
};

export async function PUT(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { label, href, type, pageId, isActive, order } = parsed.data;

  try {
    const data = await updateNavigationItem(id, {
      label: typeof label === 'string' ? label : undefined,
      href: typeof href === 'string' ? href : undefined,
      type: type === 'PAGE' ? 'PAGE' : type === 'CUSTOM' ? 'CUSTOM' : undefined,
      pageId:
        typeof pageId === 'string'
          ? pageId
          : pageId === null
            ? null
            : undefined,
      isActive: typeof isActive === 'boolean' ? isActive : undefined,
      order: typeof order === 'number' ? order : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/header/nav/[id]');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await deleteNavigationItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/header/nav/[id]');
  }
}
