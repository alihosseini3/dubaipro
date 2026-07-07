import { NextRequest, NextResponse } from 'next/server';
import { translate } from '@/lib/i18n/translate';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    text?: string;
    targetLocale?: string;
    sourceLocale?: string;
  } | null;

  if (!body?.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (!body.targetLocale || typeof body.targetLocale !== 'string') {
    return NextResponse.json({ error: 'targetLocale is required' }, { status: 400 });
  }

  const translated = await translate(body.text.trim(), body.targetLocale, body.sourceLocale ?? 'en');
  return NextResponse.json({ translated });
}
