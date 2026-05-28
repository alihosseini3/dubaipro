import { NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  getCategoryAttributes,
  assignAttributeToCategory,
  removeAttributeFromCategory,
} from '@/lib/attributes/service';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await getCategoryAttributes(id);
  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id: categoryId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const attributeId = typeof body.attributeId === 'string' ? body.attributeId : null;
  if (!attributeId) return NextResponse.json({ error: 'attributeId required' }, { status: 422 });

  const isFilterable = typeof body.isFilterable === 'boolean' ? body.isFilterable : true;
  await assignAttributeToCategory(categoryId, attributeId, isFilterable);
  const data = await getCategoryAttributes(categoryId);
  return NextResponse.json({ data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id: categoryId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const attributeId = typeof body.attributeId === 'string' ? body.attributeId : null;
  if (!attributeId) return NextResponse.json({ error: 'attributeId required' }, { status: 422 });

  await removeAttributeFromCategory(categoryId, attributeId);
  return NextResponse.json({ ok: true });
}
