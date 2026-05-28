import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  createSection,
  getSectionsByPageId,
} from '@/lib/pages/service';
import type { PageSectionType } from '@/lib/pages/types';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const data = await getSectionsByPageId(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/pages/[id]/sections');
  }
}

type CreateBody = {
  type?: unknown;
  config?: unknown;
  isVisible?: unknown;
};

const VALID_TYPES: PageSectionType[] = [
  'HERO',
  'RICH_TEXT',
  'IMAGE_BANNER',
  'CTA_BLOCK',
  'FEATURES_GRID',
  'FAQ',
  'SPACER',
];

export async function POST(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { type, config, isVisible } = parsed.data;

  if (!type || !VALID_TYPES.includes(type as PageSectionType))
    return badRequest('invalid section type');

  try {
    const section = await createSection(id, {
      type: type as PageSectionType,
      config: (config as object) ?? {},
      isVisible: typeof isVisible === 'boolean' ? isVisible : true,
    });
    return NextResponse.json({ data: section }, { status: 201 });
  } catch (error) {
    return handlePrismaError(
      error,
      'POST /api/admin/pages/[id]/sections'
    );
  }
}
