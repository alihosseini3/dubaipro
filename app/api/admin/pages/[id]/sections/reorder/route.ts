import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { reorderSections } from '@/lib/pages/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id: pageId } = await params;

  const parsed = await parseJsonBody<{ ids?: unknown }>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { ids } = parsed.data;

  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string'))
    return badRequest('ids must be string[]');

  try {
    await reorderSections(pageId, ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(
      error,
      'POST /api/admin/pages/[id]/sections/reorder'
    );
  }
}
