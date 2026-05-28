import { NextResponse } from 'next/server';

import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  getMarketingSettings,
  updateMarketingSettings,
  type MarketingSettingsUpdate
} from '@/lib/marketing/settings';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const data = await getMarketingSettings();
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/admin/marketing failed:', err);
    return serverError();
  }
}

const ALLOWED: Array<keyof MarketingSettingsUpdate> = [
  'trackingEnabled',
  'googleAdsId',
  'googleConvLabel',
  'metaPixelId',
  'metaAccessToken',
  'metaTestEventCode',
  'ga4MeasurementId',
  'ga4ApiSecret',
  'requireConsent'
];

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = await parseJsonBody<Record<string, unknown>>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const patch: MarketingSettingsUpdate = {};
  for (const key of ALLOWED) {
    if (!(key in body)) continue;
    const v = body[key];
    if (key === 'trackingEnabled' || key === 'requireConsent') {
      patch[key] = Boolean(v);
    } else if (key === 'metaAccessToken' || key === 'ga4ApiSecret') {
      // Secrets: empty string keeps the existing value, null clears.
      if (v === null) patch[key] = null;
      else if (typeof v === 'string') patch[key] = v;
    } else if (v === null || v === '') {
      patch[key] = null;
    } else if (typeof v === 'string') {
      patch[key] = v.trim();
    }
  }

  try {
    const result = await updateMarketingSettings(patch);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'validation_failed', issues: result.issues },
        { status: 422 }
      );
    }
    return NextResponse.json({ data: result.settings });
  } catch (err) {
    console.error('PUT /api/admin/marketing failed:', err);
    return serverError();
  }
}
