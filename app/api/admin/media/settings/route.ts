/**
 * GET  /api/admin/media/settings  — read current config (DB + env merged)
 * PUT  /api/admin/media/settings  — save AI settings to DB
 */

import { NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getMediaSettings, saveMediaSettings } from '@/lib/media/settings';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const s = await getMediaSettings();

  /* Also fetch raw DB row to show what's saved (for form pre-population) */
  const row = await prisma.mediaSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);

  return NextResponse.json({
    storage: {
      backend:   process.env.MEDIA_STORAGE ?? 'local',
      cdnUrl:    process.env.MEDIA_CDN_URL ?? null,
    },
    ai: {
      enabled:      s.ai.enabled,
      provider:     s.ai.provider  || null,
      model:        s.ai.model     || null,
      baseUrl:      s.ai.baseUrl   || null,
      timeoutMs:    s.ai.timeoutMs,
      autoGenerate: s.ai.autoGenerate,
      useWebSearch: s.ai.useWebSearch,
      /* hasApiKey: true/false — never expose the actual key to the client */
      hasApiKey:  !!(row?.aiApiKey || process.env.MEDIA_AI_API_KEY),
      /* source: where the active config comes from */
      source:     row?.aiProvider ? 'database' : (process.env.MEDIA_AI_PROVIDER ? 'env' : 'none'),
    },
    worker: {
      cronEnabled: true,
      hasSecret:   !!(process.env.MEDIA_WORKER_SECRET),
    },
    observability: {
      webhookEnabled: !!(process.env.OBSERVABILITY_WEBHOOK_URL),
    },
  });
}

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: {
    aiProvider?:     string | null;
    aiApiKey?:       string | null;
    aiModel?:        string | null;
    aiBaseUrl?:      string | null;
    aiTimeoutMs?:    number;
    aiAutoGenerate?: boolean;
    aiUseWebSearch?: boolean;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  /* Empty string → null (clear the field) */
  const clean = (v: string | null | undefined) => (v === '' ? null : v ?? null);

  await saveMediaSettings({
    aiProvider:      clean(body.aiProvider),
    aiApiKey:        body.aiApiKey === '' ? null : body.aiApiKey,  // null clears key
    aiModel:         clean(body.aiModel),
    aiBaseUrl:       clean(body.aiBaseUrl),
    aiTimeoutMs:     typeof body.aiTimeoutMs === 'number' ? body.aiTimeoutMs : undefined,
    aiAutoGenerate:  typeof body.aiAutoGenerate === 'boolean' ? body.aiAutoGenerate : undefined,
    aiUseWebSearch:  typeof body.aiUseWebSearch === 'boolean' ? body.aiUseWebSearch : undefined,
  });

  return NextResponse.json({ ok: true });
}
