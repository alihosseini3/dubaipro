import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function sanitize(input: string): string {
  return input.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * GET /api/admin/media/folders
 * Returns merged list: DB-aggregated folders (with file counts) + GalleryFolder records
 * (empty custom folders show count=0).
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [rows, customFolders] = await Promise.all([
    prisma.mediaAsset.groupBy({ by: ['folder'], _count: { folder: true }, orderBy: { folder: 'asc' } }),
    prisma.galleryFolder.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const countMap = new Map(rows.map((r) => [r.folder, r._count.folder]));

  // Merge: start with custom folder records, then add DB-only folders
  const seen = new Set<string>();
  const result: { name: string; count: number; label: string | null; custom: boolean }[] = [];

  for (const cf of customFolders) {
    seen.add(cf.name);
    result.push({ name: cf.name, count: countMap.get(cf.name) ?? 0, label: cf.label, custom: true });
  }
  for (const row of rows) {
    if (!seen.has(row.folder)) {
      result.push({ name: row.folder, count: row._count.folder, label: null, custom: false });
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ data: result });
}

/**
 * POST /api/admin/media/folders
 * Body: { name: string; label?: string }
 * Creates a new named folder (stored in GalleryFolder table).
 */
export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const name = sanitize(String(body.name));
  if (!name) return NextResponse.json({ error: 'invalid folder name' }, { status: 400 });

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 128) : null;

  const folder = await prisma.galleryFolder.upsert({
    where: { name },
    create: { name, label },
    update: { label },
  });

  return NextResponse.json({ data: folder }, { status: 201 });
}
