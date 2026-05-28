import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  getShippingSettings,
  updateShippingSettings
} from '@/lib/shipping/calculate';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { ShippingSettingsDTO } from '@/types/shipping';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const data = await getShippingSettings();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET shipping settings failed:', err);
    return serverError();
  }
}

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const parsed = await parseJsonBody<Partial<ShippingSettingsDTO>>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  try {
    const data = await updateShippingSettings(parsed.data);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('PUT shipping settings failed:', err);
    return serverError();
  }
}
