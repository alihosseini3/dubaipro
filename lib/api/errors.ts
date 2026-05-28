import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import type { ValidationErrors } from './validation';

export function badRequest(error: string, details?: ValidationErrors) {
  return NextResponse.json(
    details ? { error, details } : { error },
    { status: 400 }
  );
}

export function notFound(error = 'Resource not found') {
  return NextResponse.json({ error }, { status: 404 });
}

export function conflict(error: string) {
  return NextResponse.json({ error }, { status: 409 });
}

export function serverError(error = 'Internal server error') {
  return NextResponse.json({ error }, { status: 500 });
}

export function handlePrismaError(error: unknown, context: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ');
      return conflict(
        target ? `Unique constraint failed on: ${target}` : 'Duplicate value'
      );
    }
    if (error.code === 'P2003') {
      return badRequest('Invalid foreign key reference');
    }
    if (error.code === 'P2025') {
      return notFound('Record not found');
    }
  }
  console.error(`${context} failed:`, error);
  return serverError();
}
