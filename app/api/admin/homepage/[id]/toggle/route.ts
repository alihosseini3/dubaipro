import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { toggleSection } from '@/lib/homepage/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
type Body = { active?: unknown };

export async function POST(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { active } = parsed.data;
  if (typeof active !== 'boolean') return badRequest('active must be boolean');

  try {
    const data = await toggleSection(id, active);
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, `POST /api/admin/homepage/${id}/toggle`);
  }
}
