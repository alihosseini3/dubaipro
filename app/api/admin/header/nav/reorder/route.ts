import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { reorderNavigationItems } from '@/lib/header/service';

export const runtime = 'nodejs';

type Body = { ids?: unknown };

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { ids } = parsed.data;

  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
    return badRequest('ids must be a string[]');
  }

  try {
    await reorderNavigationItems(ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/header/nav/reorder');
  }
}
