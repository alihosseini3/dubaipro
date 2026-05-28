import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { deleteSection, updateSection } from '@/lib/homepage/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type PatchBody = {
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

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  try {
    const data = await updateSection(id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      subtitle:
        body.subtitle === undefined
          ? undefined
          : typeof body.subtitle === 'string'
            ? body.subtitle
            : null,
      ctaLabel:
        body.ctaLabel === undefined
          ? undefined
          : typeof body.ctaLabel === 'string'
            ? body.ctaLabel
            : null,
      ctaHref:
        body.ctaHref === undefined
          ? undefined
          : typeof body.ctaHref === 'string'
            ? body.ctaHref
            : null,
      ctaSecondaryLabel:
        body.ctaSecondaryLabel === undefined
          ? undefined
          : typeof body.ctaSecondaryLabel === 'string'
            ? body.ctaSecondaryLabel
            : null,
      ctaSecondaryHref:
        body.ctaSecondaryHref === undefined
          ? undefined
          : typeof body.ctaSecondaryHref === 'string'
            ? body.ctaSecondaryHref
            : null,
      badge:
        body.badge === undefined
          ? undefined
          : typeof body.badge === 'string'
            ? body.badge
            : null,
      imageUrl:
        body.imageUrl === undefined
          ? undefined
          : typeof body.imageUrl === 'string'
            ? body.imageUrl
            : null,
      config:
        body.config === undefined
          ? undefined
          : body.config && typeof body.config === 'object' && !Array.isArray(body.config)
            ? (body.config as Record<string, unknown>)
            : null,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/admin/homepage/${id}`);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await deleteSection(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/admin/homepage/${id}`);
  }
}
