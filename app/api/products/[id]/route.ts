import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  badRequest,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import {
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isNonNegativeNumber,
  parseJsonBody,
  slugify,
  type ValidationErrors
} from '@/lib/api/validation';
import { setProductAttributeValues } from '@/lib/attributes/service';

type UpdateProductBody = {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  stock?: unknown;
  currency?: unknown;
  isB2B?: unknown;
  supplierId?: unknown;
  categoryId?: unknown;
  brandId?: unknown;
  imageUrl?: unknown;
  images?: unknown;
  weight?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  shippingClass?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  attributeValues?: unknown;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        supplier: { select: { id: true, userId: true, name: true, country: true, phone: true } }
      }
    });

    if (!product) return notFound('Product not found');
    return NextResponse.json({ data: product });
  } catch (error) {
    return handlePrismaError(error, `GET /api/products/${id}`);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const parsed = await parseJsonBody<UpdateProductBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) {
      errors.title = 'title must be a non-empty string';
    } else {
      data.title = body.title.trim();
    }
  }
  if (body.slug !== undefined) {
    if (!isNonEmptyString(body.slug)) {
      errors.slug = 'slug must be a non-empty string';
    } else {
      data.slug = slugify(body.slug);
    }
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.description = 'description must be a string';
    } else {
      data.description = body.description;
    }
  }
  if (body.price !== undefined) {
    if (!isNonNegativeNumber(body.price)) {
      errors.price = 'price must be a non-negative number';
    } else {
      data.price = body.price;
    }
  }
  if (body.compareAtPrice !== undefined) {
    if (body.compareAtPrice === null) {
      data.compareAtPrice = null;
    } else if (isNonNegativeNumber(body.compareAtPrice)) {
      data.compareAtPrice = (body.compareAtPrice as number) > 0 ? body.compareAtPrice : null;
    } else {
      errors.compareAtPrice = 'compareAtPrice must be a non-negative number or null';
    }
  }
  if (body.stock !== undefined) {
    if (!isNonNegativeInteger(body.stock)) {
      errors.stock = 'stock must be a non-negative integer';
    } else {
      data.stock = body.stock;
    }
  }
  if (body.currency !== undefined) {
    if (!isNonEmptyString(body.currency)) {
      errors.currency = 'currency must be a non-empty string';
    } else {
      data.currency = body.currency.toUpperCase();
    }
  }
  if (body.isB2B !== undefined) {
    if (!isBoolean(body.isB2B)) {
      errors.isB2B = 'isB2B must be a boolean';
    } else {
      data.isB2B = body.isB2B;
    }
  }
  if (body.supplierId !== undefined) {
    if (!isNonEmptyString(body.supplierId)) {
      errors.supplierId = 'supplierId must be a non-empty string';
    } else {
      data.supplierId = body.supplierId;
    }
  }
  if (body.categoryId !== undefined) {
    if (!isNonEmptyString(body.categoryId)) {
      errors.categoryId = 'categoryId must be a non-empty string';
    } else {
      data.categoryId = body.categoryId;
    }
  }
  if (body.brandId !== undefined) {
    if (body.brandId !== null && typeof body.brandId !== 'string') {
      errors.brandId = 'brandId must be a string or null';
    } else {
      data.brandId = body.brandId;
    }
  }
  if (body.imageUrl !== undefined) {
    if (
      body.imageUrl !== null &&
      (typeof body.imageUrl !== 'string' || body.imageUrl.length > 2048)
    ) {
      errors.imageUrl = 'imageUrl must be a string or null';
    } else {
      data.imageUrl =
        typeof body.imageUrl === 'string' && body.imageUrl.length > 0
          ? body.imageUrl
          : null;
    }
  }
  if (body.images !== undefined) {
    if (
      body.images !== null &&
      (!Array.isArray(body.images) ||
        !body.images.every(
          (v) => typeof v === 'string' && v.length <= 2048
        ))
    ) {
      errors.images = 'images must be an array of strings';
    } else {
      data.images = body.images;
    }
  }

  // ---- Shipping metadata (all nullable) -----------------------------
  for (const k of ['weight', 'length', 'width', 'height'] as const) {
    const v = body[k];
    if (v !== undefined) {
      if (v === null) data[k] = null;
      else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) data[k] = v;
      else errors[k] = `${k} must be a non-negative number or null`;
    }
  }
  if (body.shippingClass !== undefined) {
    if (body.shippingClass === null) {
      data.shippingClass = null;
    } else if (typeof body.shippingClass === 'string') {
      data.shippingClass = body.shippingClass.trim() || null;
    } else {
      errors.shippingClass = 'shippingClass must be a string or null';
    }
  }

  // ---- SEO overrides (admin-controlled) -----------------------------
  for (const k of ['metaTitle', 'metaDescription'] as const) {
    const v = body[k];
    if (v === undefined) continue;
    if (v === null) {
      data[k] = null;
      continue;
    }
    const max = k === 'metaTitle' ? 70 : 200;
    if (typeof v !== 'string' || v.length > max) {
      errors[k] = `${k} must be a string up to ${max} chars or null`;
    } else {
      data[k] = v.trim() || null;
    }
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  if (Object.keys(data).length === 0) {
    return badRequest('No fields provided to update');
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data
    });

    if (
      body.attributeValues !== undefined &&
      typeof body.attributeValues === 'object' &&
      body.attributeValues !== null &&
      !Array.isArray(body.attributeValues)
    ) {
      await setProductAttributeValues(id, body.attributeValues as Record<string, string>);
    }

    return NextResponse.json({ data: product });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/products/${id}`);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/products/${id}`);
  }
}
