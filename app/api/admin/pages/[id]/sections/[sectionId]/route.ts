import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { deleteSection, updateSection } from '@/lib/pages/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; sectionId: string }> };

type UpdateBody = {
  config?: unknown;
  isVisible?: unknown;
  order?: unknown;
};

export async function PUT(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { sectionId } = await params;

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { config, isVisible, order } = parsed.data;

  try {
    const section = await updateSection(sectionId, {
      config: config != null ? (config as object) : undefined,
      isVisible: typeof isVisible === 'boolean' ? isVisible : undefined,
      order: typeof order === 'number' ? order : undefined,
    });
    return NextResponse.json({ data: section });
  } catch (error) {
    return handlePrismaError(
      error,
      'PUT /api/admin/pages/[id]/sections/[sectionId]'
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { sectionId } = await params;
  try {
    await deleteSection(sectionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(
      error,
      'DELETE /api/admin/pages/[id]/sections/[sectionId]'
    );
  }
}
