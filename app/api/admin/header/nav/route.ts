import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { createNavigationItem, listNavigationItems } from '@/lib/header/service';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await listNavigationItems({ activeOnly: false });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/header/nav');
  }
}

type CreateBody = {
  label?: unknown;
  href?: unknown;
  type?: unknown;
  pageId?: unknown;
  isActive?: unknown;
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { label, href, type, pageId, isActive } = parsed.data;

  if (!isNonEmptyString(label)) return badRequest('label is required');

  // `type` defaults to CUSTOM. PAGE-typed items derive their href from
  // the linked page slug, so href is only required for CUSTOM links.
  const navType = type === 'PAGE' ? 'PAGE' : 'CUSTOM';
  if (navType === 'CUSTOM' && !isNonEmptyString(href)) {
    return badRequest('href is required for custom links');
  }
  if (navType === 'PAGE' && !isNonEmptyString(pageId)) {
    return badRequest('pageId is required for page links');
  }

  try {
    const data = await createNavigationItem({
      label,
      href: typeof href === 'string' ? href : undefined,
      type: navType,
      pageId: typeof pageId === 'string' ? pageId : null,
      isActive: typeof isActive === 'boolean' ? isActive : true
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/header/nav');
  }
}
