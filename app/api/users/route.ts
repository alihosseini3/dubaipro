import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/api/errors';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } }
      }
    });
    return NextResponse.json({ data: users });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/users');
  }
}
