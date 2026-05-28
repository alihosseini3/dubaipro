import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getFilterSettings, updateFilterSettings } from '@/lib/filters/settings';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const settings = await getFilterSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate each field individually — only accept known keys
  const update: Record<string, unknown> = {};
  const booleans = [
    'showPriceFilter','showBrandFilter','showSupplierFilter',
    'showInStockFilter','showB2BFilter',
    'showRatingFilter','showDiscountFilter','showNewArrivalsFilter','showSearchFilter',
  ];
  const integers = ['maxBrandsVisible','maxSuppliersVisible','priceSliderStep'];
  const strings  = [
    'priceLabel','brandLabel','supplierLabel','availabilityLabel',
    'ratingLabel','discountLabel','newArrivalsLabel','searchLabel',
  ];
  const issues: string[] = [];

  for (const k of booleans) {
    if (k in body) {
      if (typeof body[k] !== 'boolean') { issues.push(`${k} must be boolean`); continue; }
      update[k] = body[k];
    }
  }
  for (const k of integers) {
    if (k in body) {
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < 1 || n > 100) { issues.push(`${k} must be integer 1–100`); continue; }
      update[k] = n;
    }
  }
  for (const k of strings) {
    if (k in body) {
      if (typeof body[k] !== 'string' || (body[k] as string).trim().length === 0) {
        issues.push(`${k} must be a non-empty string`);
        continue;
      }
      update[k] = (body[k] as string).trim().slice(0, 60);
    }
  }

  if (issues.length > 0) {
    return NextResponse.json({ error: 'Validation failed', issues }, { status: 422 });
  }

  const updated = await updateFilterSettings(update);
  return NextResponse.json({ data: updated });
}
