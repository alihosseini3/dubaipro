import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { addMegaMenuItem, listMegaMenuItems } from '@/lib/header/service';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await listMegaMenuItems({ activeOnly: false });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/header/mega');
  }
}

type CreateBody = {
  categoryId?: unknown;
  title?: unknown;
  image?: unknown;
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { categoryId, title, image } = parsed.data;

  if (!isNonEmptyString(categoryId)) return badRequest('categoryId is required');

  try {
    const data = await addMegaMenuItem({
      categoryId,
      title: typeof title === 'string' ? title : null,
      image: typeof image === 'string' ? image : null
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/header/mega');
  }
}
