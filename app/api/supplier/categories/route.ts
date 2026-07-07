import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/supplier/categories
 *
 * Public list of active categories for the supplier onboarding wizard
 * (Step 4). Returns a flat list with `parentId` so the client can group
 * sub-categories under their parent. Reuses the existing Category table.
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        icon: true,
      },
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/categories');
  }
}
