import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import {
  HOMEPAGE_SECTION_TYPES,
  createSection,
  listSections
} from '@/lib/homepage/service';
import type { HomepageSectionType } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await listSections();
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/homepage');
  }
}

type CreateBody = {
  type?: unknown;
  title?: unknown;
  subtitle?: unknown;
  ctaLabel?: unknown;
  ctaHref?: unknown;
  ctaSecondaryLabel?: unknown;
  ctaSecondaryHref?: unknown;
  badge?: unknown;
  imageUrl?: unknown;
  config?: unknown;
  isActive?: unknown;
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.type)) return badRequest('type is required');
  if (!HOMEPAGE_SECTION_TYPES.includes(body.type as HomepageSectionType)) {
    return badRequest('invalid section type');
  }
  if (!isNonEmptyString(body.title)) return badRequest('title is required');

  try {
    const data = await createSection({
      type: body.type as HomepageSectionType,
      title: body.title,
      subtitle: typeof body.subtitle === 'string' ? body.subtitle : null,
      ctaLabel: typeof body.ctaLabel === 'string' ? body.ctaLabel : null,
      ctaHref: typeof body.ctaHref === 'string' ? body.ctaHref : null,
      ctaSecondaryLabel:
        typeof body.ctaSecondaryLabel === 'string' ? body.ctaSecondaryLabel : null,
      ctaSecondaryHref:
        typeof body.ctaSecondaryHref === 'string' ? body.ctaSecondaryHref : null,
      badge: typeof body.badge === 'string' ? body.badge : null,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      config:
        body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? (body.config as Record<string, unknown>)
          : null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/homepage');
  }
}
