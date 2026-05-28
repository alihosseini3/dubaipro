import { NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getCategoryFilterConfig, upsertCategoryFilterConfig } from '@/lib/attributes/service';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await getCategoryFilterConfig(id);
  return NextResponse.json({ data });
}

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id: categoryId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const boolOrNull = (v: unknown) => (v === null ? null : typeof v === 'boolean' ? v : null);

  await upsertCategoryFilterConfig(categoryId, {
    showPriceFilter:       boolOrNull(body.showPriceFilter),
    showBrandFilter:       boolOrNull(body.showBrandFilter),
    showSupplierFilter:    boolOrNull(body.showSupplierFilter),
    showInStockFilter:     boolOrNull(body.showInStockFilter),
    showB2BFilter:         boolOrNull(body.showB2BFilter),
    showRatingFilter:      boolOrNull(body.showRatingFilter),
    showDiscountFilter:    boolOrNull(body.showDiscountFilter),
    showNewArrivalsFilter: boolOrNull(body.showNewArrivalsFilter),
    showSearchFilter:      boolOrNull(body.showSearchFilter),
  });

  const data = await getCategoryFilterConfig(categoryId);
  return NextResponse.json({ data });
}
