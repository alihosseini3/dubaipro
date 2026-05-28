import { NextResponse } from 'next/server';
import { type Prisma, RfqStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import {
  isNonEmptyString,
  isNonNegativeInteger,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';

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
    const statusParam = searchParams.get('status')?.trim().toUpperCase();
    const supplierId = searchParams.get('supplierId')?.trim();

    const where: Prisma.RFQWhereInput = {};
    if (statusParam && statusParam in RfqStatus) {
      where.status = statusParam as RfqStatus;
    }
    if (supplierId) where.supplierId = supplierId;

    const [data, total] = await Promise.all([
      prisma.rFQ.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { id: true, title: true, slug: true } },
          supplier: { select: { id: true, name: true, country: true } },
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.rFQ.count({ where })
    ]);

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/rfq');
  }
}

type CreateRfqBody = {
  productId?: unknown;
  quantity?: unknown;
  message?: unknown;
};

const MAX_MESSAGE_LENGTH = 5000;
const MAX_QUANTITY = 10_000_000;

export async function POST(request: Request) {
  const parsed = await parseJsonBody<CreateRfqBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};

  if (!isNonEmptyString(body.productId)) {
    errors.productId = 'productId is required';
  }

  if (
    !isNonNegativeInteger(body.quantity) ||
    (body.quantity as number) < 1 ||
    (body.quantity as number) > MAX_QUANTITY
  ) {
    errors.quantity = `quantity must be an integer between 1 and ${MAX_QUANTITY}`;
  }

  if (body.message !== undefined && typeof body.message !== 'string') {
    errors.message = 'message must be a string';
  }

  if (
    typeof body.message === 'string' &&
    body.message.length > MAX_MESSAGE_LENGTH
  ) {
    errors.message = `message must be at most ${MAX_MESSAGE_LENGTH} characters`;
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  const productId = body.productId as string;

  // Attach the authenticated user (if any). Guests may still submit RFQs;
  // the schema allows a null userId for that case.
  const sessionUser = await getCurrentUser();

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, supplierId: true }
    });

    if (!product) return notFound('Product not found');

    const rfq = await prisma.rFQ.create({
      data: {
        productId: product.id,
        supplierId: product.supplierId,
        quantity: body.quantity as number,
        message: typeof body.message === 'string' ? body.message.trim() : '',
        ...(sessionUser ? { userId: sessionUser.id } : {})
      }
    });

    return NextResponse.json({ data: rfq }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/rfq');
  }
}
