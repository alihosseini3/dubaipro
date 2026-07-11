import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { CATEGORIES_CACHE_TAG } from '@/lib/categories/service';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  slugify,
  type ValidationErrors
} from '@/lib/api/validation';

type UpdateCategoryBody = {
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

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const parsed = await parseJsonBody<UpdateCategoryBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) errors.name = 'name must be non-empty';
    else data.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (!isNonEmptyString(body.slug)) errors.slug = 'slug must be non-empty';
    else data.slug = slugify(body.slug);
  }
  if (body.parentId !== undefined) {
    data.parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
  }
  if (body.icon !== undefined) {
    data.icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : null;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 500) : null;
  }
  if (body.metaTitle !== undefined) {
    data.metaTitle = typeof body.metaTitle === 'string' && body.metaTitle.trim() ? body.metaTitle.trim().slice(0, 70) : null;
  }
  if (body.metaDescription !== undefined) {
    data.metaDescription = typeof body.metaDescription === 'string' && body.metaDescription.trim() ? body.metaDescription.trim().slice(0, 200) : null;
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== 'number') errors.sortOrder = 'sortOrder must be a number';
    else data.sortOrder = Math.trunc(body.sortOrder);
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') errors.isActive = 'isActive must be a boolean';
    else data.isActive = body.isActive;
  }

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);
  if (Object.keys(data).length === 0) return badRequest('No fields to update');

  try {
    const category = await prisma.category.update({ where: { id }, data });
    revalidateTag(CATEGORIES_CACHE_TAG);
    return NextResponse.json({ data: category });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/categories/${id}`);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.category.delete({ where: { id } });
    revalidateTag(CATEGORIES_CACHE_TAG);
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/categories/${id}`);
  }
}
