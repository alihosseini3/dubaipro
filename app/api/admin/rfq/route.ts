import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import type { RfqRequestStatus } from '@prisma/client';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const sp = url.searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const status = sp.get('status') ?? undefined;
  const search = sp.get('q') ?? undefined;

  try {
    const where = {
      ...(status ? { status: status as RfqRequestStatus } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.rfqRequest.findMany({
        where,
        select: {
          id: true, slug: true, title: true, status: true, urgency: true,
          quoteCount: true, viewCount: true, createdAt: true,
          user: { select: { name: true, email: true } },
          category: { select: { name: true } },
          _count: { select: { quotes: true, messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rfqRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/rfq');
  }
}
