import { NextResponse } from 'next/server';
import { RfqStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody, type ValidationErrors } from '@/lib/api/validation';

type UpdateRfqBody = {
  status?: unknown;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true, slug: true, price: true } },
        supplier: { select: { id: true, name: true, country: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });
    if (!rfq) return notFound('RFQ not found');
    return NextResponse.json({ data: rfq });
  } catch (error) {
    return handlePrismaError(error, `GET /api/rfq/${id}`);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const parsed = await parseJsonBody<UpdateRfqBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const statusUpper =
      typeof body.status === 'string' ? body.status.toUpperCase() : '';
    if (!(statusUpper in RfqStatus)) {
      errors.status = `status must be one of ${Object.values(RfqStatus).join(', ')}`;
    } else {
      data.status = statusUpper as RfqStatus;
    }
  }

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);
  if (Object.keys(data).length === 0) return badRequest('No fields to update');

  try {
    const rfq = await prisma.rFQ.update({ where: { id }, data });
    return NextResponse.json({ data: rfq });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/rfq/${id}`);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.rFQ.delete({ where: { id } });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/rfq/${id}`);
  }
}
