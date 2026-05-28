import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const folder  = searchParams.get('folder') || 'all';
  const search  = searchParams.get('search') || '';
  const sort    = searchParams.get('sort') || 'newest';
  const page    = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const mime    = searchParams.get('mime') || '';

  const where: Record<string, unknown> = {};
  if (folder !== 'all') where.folder = folder;
  if (mime) where.mimeType = { contains: mime };
  if (search) {
    where.OR = [
      { originalName: { contains: search, mode: 'insensitive' } },
      { alt:          { contains: search, mode: 'insensitive' } },
      { title:        { contains: search, mode: 'insensitive' } },
      { tags:         { has: search } },
    ];
  }

  const orderBy =
    sort === 'oldest' ? { createdAt: 'asc' as const }
    : sort === 'name' ? { originalName: 'asc' as const }
    : sort === 'size' ? { size: 'desc' as const }
    : { createdAt: 'desc' as const };

  try {
    const [total, assets] = await prisma.$transaction([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, filename: true, originalName: true, url: true,
          mimeType: true, size: true, width: true, height: true,
          alt: true, title: true, caption: true,
          folder: true, tags: true, createdAt: true,
          uploadedBy: { select: { name: true } },
        },
      }),
    ]);
    return NextResponse.json({ data: assets, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/media');
  }
}
