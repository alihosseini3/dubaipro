import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
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

type CreateProductBody = {
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

function isOptionalUrl(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true;
  return typeof value === 'string' && value.length <= 2048;
}

function isOptionalStringArray(
  value: unknown
): value is string[] | null | undefined {
  if (value === undefined || value === null) return true;
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && v.length <= 2048)
  );
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)
    );

    const search = searchParams.get('search')?.trim();
    const slug = searchParams.get('slug')?.trim();
    const categoryId = searchParams.get('categoryId')?.trim();
    const supplierId = searchParams.get('supplierId')?.trim();
    const brandId = searchParams.get('brandId')?.trim();
    const isB2BParam = searchParams.get('isB2B');

    const where: Prisma.ProductWhereInput = {};
    if (slug) where.slug = slug;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (brandId) where.brandId = brandId;
    if (isB2BParam === 'true') where.isB2B = true;
    if (isB2BParam === 'false') where.isB2B = false;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, userId: true, name: true, country: true, phone: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/products');
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody<CreateProductBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};

  if (!isNonEmptyString(body.title)) {
    errors.title = 'title is required';
  }
  if (!isNonNegativeNumber(body.price)) {
    errors.price = 'price must be a non-negative number';
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    errors.description = 'description must be a string';
  }
  if (body.slug !== undefined && typeof body.slug !== 'string') {
    errors.slug = 'slug must be a string';
  }
  if (body.stock !== undefined && !isNonNegativeInteger(body.stock)) {
    errors.stock = 'stock must be a non-negative integer';
  }
  if (body.currency !== undefined && !isNonEmptyString(body.currency)) {
    errors.currency = 'currency must be a non-empty string';
  }
  if (body.isB2B !== undefined && !isBoolean(body.isB2B)) {
    errors.isB2B = 'isB2B must be a boolean';
  }
  if (!isNonEmptyString(body.supplierId)) {
    errors.supplierId = 'supplierId is required';
  }
  if (!isNonEmptyString(body.categoryId)) {
    errors.categoryId = 'categoryId is required';
  }
  if (
    body.brandId !== undefined &&
    body.brandId !== null &&
    typeof body.brandId !== 'string'
  ) {
    errors.brandId = 'brandId must be a string or null';
  }
  if (!isOptionalUrl(body.imageUrl)) {
    errors.imageUrl = 'imageUrl must be a string or null';
  }
  if (!isOptionalStringArray(body.images)) {
    errors.images = 'images must be an array of strings';
  }
  if (
    body.metaTitle !== undefined &&
    body.metaTitle !== null &&
    (typeof body.metaTitle !== 'string' || body.metaTitle.length > 70)
  ) {
    errors.metaTitle = 'metaTitle must be a string up to 70 chars';
  }
  if (
    body.metaDescription !== undefined &&
    body.metaDescription !== null &&
    (typeof body.metaDescription !== 'string' || body.metaDescription.length > 200)
  ) {
    errors.metaDescription = 'metaDescription must be a string up to 200 chars';
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  const title = (body.title as string).trim();
  const slug = isNonEmptyString(body.slug) ? slugify(body.slug) : slugify(title);

  try {
    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description:
          typeof body.description === 'string' ? body.description : '',
        price: body.price as number,
        compareAtPrice: typeof body.compareAtPrice === 'number' && body.compareAtPrice > 0
          ? body.compareAtPrice
          : null,
        stock: typeof body.stock === 'number' ? body.stock : 0,
        isB2B: typeof body.isB2B === 'boolean' ? body.isB2B : false,
        supplierId: body.supplierId as string,
        categoryId: body.categoryId as string,
        brandId: typeof body.brandId === 'string' ? body.brandId : null,
        imageUrl:
          typeof body.imageUrl === 'string' && body.imageUrl.length > 0
            ? body.imageUrl
            : null,
        images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
        weight: typeof body.weight === 'number' ? body.weight : null,
        length: typeof body.length === 'number' ? body.length : null,
        width: typeof body.width === 'number' ? body.width : null,
        height: typeof body.height === 'number' ? body.height : null,
        shippingClass:
          typeof body.shippingClass === 'string' && body.shippingClass.trim()
            ? body.shippingClass.trim()
            : 'normal',
        metaTitle:
          typeof body.metaTitle === 'string' && body.metaTitle.trim()
            ? body.metaTitle.trim()
            : null,
        metaDescription:
          typeof body.metaDescription === 'string' && body.metaDescription.trim()
            ? body.metaDescription.trim()
            : null,
        ...(isNonEmptyString(body.currency)
          ? { currency: body.currency.toUpperCase() }
          : {})
      }
    });

    if (
      body.attributeValues !== undefined &&
      typeof body.attributeValues === 'object' &&
      body.attributeValues !== null &&
      !Array.isArray(body.attributeValues)
    ) {
      await setProductAttributeValues(product.id, body.attributeValues as Record<string, string>);
    }

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/products');
  }
}