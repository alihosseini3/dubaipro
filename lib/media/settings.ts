/**
 * Media system runtime settings loader.
 *
 * Priority: DB (MediaSettings singleton) → env vars → hardcoded defaults.
 * DB values override env vars so admins can configure from the panel.
 *
 * Cache: 60-second in-memory TTL to avoid per-request DB hits.
 * Call `invalidateMediaSettingsCache()` after a PUT to flush immediately.
 */

import 'server-only';
import { prisma } from '@/lib/prisma';

export interface ResolvedMediaSettings {
  ai: {
    enabled:        boolean;
    provider:       string;
    apiKey:         string;
    model:          string;
    baseUrl:        string;
    timeoutMs:      number;
    autoGenerate:   boolean;
    useWebSearch:   boolean;
  };
}

/* ── In-memory cache ──────────────────────────────────────────────────────── */
let cachedAt = 0;
let cached: ResolvedMediaSettings | null = null;
const CACHE_TTL_MS = 60_000;

export function invalidateMediaSettingsCache(): void {
  cachedAt = 0;
  cached   = null;
}

export async function getMediaSettings(): Promise<ResolvedMediaSettings> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  /* Load from DB */
  const row = await prisma.mediaSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);

  /* Merge DB → env → defaults (first non-empty wins).
   * OPENAI_API_KEY is accepted as a convenience alias for MEDIA_AI_API_KEY
   * so projects that already have OpenAI configured don't need a second key. */
  const apiKey    = row?.aiApiKey   ?? process.env.MEDIA_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const provider  = row?.aiProvider ?? process.env.MEDIA_AI_PROVIDER ?? (apiKey && process.env.OPENAI_API_KEY ? 'openai' : '');
  const model     = row?.aiModel    ?? process.env.MEDIA_AI_MODEL       ?? '';
  const baseUrl   = row?.aiBaseUrl  ?? process.env.MEDIA_AI_BASE_URL    ?? '';
  const timeoutMs = row?.aiTimeoutMs ?? Number(process.env.MEDIA_AI_TIMEOUT_MS ?? 10_000);
  const autoGenerate = row?.aiAutoGenerate ?? (process.env.MEDIA_AI_AUTO_GENERATE === 'true');
  const useWebSearch  = row?.aiUseWebSearch  ?? (process.env.MEDIA_AI_USE_WEB_SEARCH === 'true');

  cached = {
    ai: {
      enabled:   !!(provider && apiKey),
      provider:  provider.toLowerCase(),
      apiKey,
      model,
      baseUrl,
      timeoutMs,
      autoGenerate,
      useWebSearch,
    },
  };
  cachedAt = now;
  return cached;
}

/** Upsert MediaSettings row (admin panel save). Flushes cache. */
export async function saveMediaSettings(data: {
  aiProvider?: string | null;
  aiApiKey?:   string | null;
  aiModel?:    string | null;
  aiBaseUrl?:  string | null;
  aiTimeoutMs?: number;
  aiAutoGenerate?: boolean;
  aiUseWebSearch?: boolean;
}): Promise<void> {
  await prisma.mediaSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  invalidateMediaSettingsCache();
}
