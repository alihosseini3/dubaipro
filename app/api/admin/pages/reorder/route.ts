import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { reorderPages } from '@/lib/pages/service';

export const runtime = 'nodejs';

type Body = { ids?: unknown };

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { ids } = parsed.data;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
    return badRequest('ids must be a string[]');
  }

  try {
    await reorderPages(ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/pages/reorder');
  }
}
