import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { removeMegaMenuItem, updateMegaMenuItem } from '@/lib/header/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type UpdateBody = {
  title?: unknown;
  image?: unknown;
  isActive?: unknown;
};

export async function PUT(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { title, image, isActive } = parsed.data;

  try {
    const data = await updateMegaMenuItem(id, {
      title:
        title === null
          ? null
          : typeof title === 'string'
            ? title
            : undefined,
      image:
        image === null
          ? null
          : typeof image === 'string'
            ? image
            : undefined,
      isActive: typeof isActive === 'boolean' ? isActive : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/header/mega/[id]');
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await removeMegaMenuItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/header/mega/[id]');
  }
}
