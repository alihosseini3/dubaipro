import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  slugify,
  type ValidationErrors
} from '@/lib/api/validation';

type CreateCategoryBody = {
  name?: unknown;
  slug?: unknown;
  parentId?: unknown;
  icon?: unknown;
  imageUrl?: unknown;
  description?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
};

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } }
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/categories');
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<CreateCategoryBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  if (!isNonEmptyString(body.name)) errors.name = 'name is required';

  const rawSlug =
    isNonEmptyString(body.slug) && body.slug.trim().length > 0
      ? body.slug
      : isNonEmptyString(body.name)
        ? body.name
        : '';
  const slug = slugify(rawSlug);
  if (!slug) errors.slug = 'slug could not be derived';

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: (body.name as string).trim(),
        slug,
        parentId:    typeof body.parentId    === 'string' && body.parentId.trim()    ? body.parentId.trim()    : null,
        icon:        typeof body.icon        === 'string' && body.icon.trim()        ? body.icon.trim()        : null,
        imageUrl:    typeof body.imageUrl    === 'string' && body.imageUrl.trim()    ? body.imageUrl.trim()    : null,
        description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
        metaTitle:   typeof body.metaTitle   === 'string' && body.metaTitle.trim()   ? body.metaTitle.trim().slice(0, 70)   : null,
        metaDescription: typeof body.metaDescription === 'string' && body.metaDescription.trim() ? body.metaDescription.trim().slice(0, 200) : null,
        sortOrder: typeof body.sortOrder === 'number' ? Math.trunc(body.sortOrder) : 0,
        isActive:  typeof body.isActive  === 'boolean' ? body.isActive : true,
      }
    });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/categories');
  }
}
