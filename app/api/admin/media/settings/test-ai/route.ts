/**
 * POST /api/admin/media/settings/test-ai
 * Tests AI Vision connectivity by sending a tiny public image.
 */

import { NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { generateImageMeta, isAiVisionEnabled } from '@/lib/media/ai-vision';

export const runtime = 'nodejs';

const TEST_IMAGE_URL = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

export async function POST() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await isAiVisionEnabled())) {
    return NextResponse.json({ ok: false, message: 'AI Vision غیرفعال است. ابتدا Provider و API Key را تنظیم کنید.' });
  }

  try {
    /* Fetch test image bytes */
    const imgRes = await fetch(TEST_IMAGE_URL, { signal: AbortSignal.timeout(10_000) });
    if (!imgRes.ok) return NextResponse.json({ ok: false, message: 'دانلود تصویر تست ناموفق' });
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const result = await generateImageMeta(
      { buffer, mimeType: 'image/png' },
      { context: 'test' },
    );
    if (result) {
      return NextResponse.json({ ok: true, message: `اتصال برقرار است (${result.provider}). ALT: "${result.alt}"` });
    }
    return NextResponse.json({ ok: false, message: 'پاسخی از AI دریافت نشد. API key یا quota را بررسی کنید.' });
  } catch (err) {
    return NextResponse.json({ ok: false, message: `خطا: ${err instanceof Error ? err.message : String(err)}` });
  }
}
