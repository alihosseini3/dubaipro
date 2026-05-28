import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  slugify,
  type ValidationErrors
} from '@/lib/api/validation';

type CreateBrandBody = {
  name?: unknown;
  slug?: unknown;
};

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ data: brands });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/brands');
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<CreateBrandBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  if (!isNonEmptyString(body.name)) errors.name = 'name is required';

  const rawSlug = isNonEmptyString(body.slug)
    ? body.slug
    : isNonEmptyString(body.name)
      ? body.name
      : '';
  const slug = slugify(rawSlug);
  if (!slug) errors.slug = 'slug could not be derived';

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);

  try {
    const brand = await prisma.brand.create({
      data: { name: (body.name as string).trim(), slug }
    });
    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/brands');
  }
}
