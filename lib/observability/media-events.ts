/**
 * Structured event logging for the Media System.
 *
 * Outputs structured JSON to stdout (captured by Vercel/Railway/Fly logs).
 * Optionally forwards to an external observability endpoint via
 * OBSERVABILITY_WEBHOOK_URL (bearer token: OBSERVABILITY_WEBHOOK_SECRET).
 *
 * Design:
 *   - Zero deps — uses console.log with JSON formatting
 *   - Fire-and-forget HTTP webhook (non-blocking, swallowed errors)
 *   - Compatible with Sentry: if window.__Sentry or global Sentry is available
 *     at runtime, errors are also captured there automatically via Next.js
 *     instrumentation hooks (no direct import needed here)
 */

export type MediaEventType =
  | 'upload_started'
  | 'upload_completed'
  | 'upload_failed'
  | 'transform_queued'
  | 'transform_completed'
  | 'transform_failed'
  | 'cleanup_completed'
  | 'replace_completed'
  | 'delete_blocked'
  | 'delete_completed'
  | 'rate_limit_hit'
  | 'ai_alt_generated'
  | 'ai_alt_failed';

export interface MediaEvent {
  event:     MediaEventType;
  assetId?:  string;
  jobId?:    string;
  userId?:   string;
  folder?:   string;
  mimeType?: string;
  sizeBytes?: number;
  duration?:  number;   // ms
  score?:     number;
  error?:     string;
  meta?:      Record<string, unknown>;
}

const WEBHOOK_URL    = process.env.OBSERVABILITY_WEBHOOK_URL ?? '';
const WEBHOOK_SECRET = process.env.OBSERVABILITY_WEBHOOK_SECRET ?? '';
const IS_PROD        = process.env.NODE_ENV === 'production';

/** Emit a structured media event. Always synchronous for the log line;
 *  webhook delivery is async fire-and-forget. */
export function emitMediaEvent(ev: MediaEvent): void {
  const entry = {
    ts:      new Date().toISOString(),
    service: 'media',
    ...ev,
  };

  if (IS_PROD) {
    /* Production: emit as JSON line (parsed by log aggregators) */
    console.log(JSON.stringify(entry));
  } else {
    /* Development: readable output */
    const icon: Record<MediaEventType, string> = {
      upload_started:       '📤',
      upload_completed:     '✅',
      upload_failed:        '❌',
      transform_queued:     '⏳',
      transform_completed:  '✅',
      transform_failed:     '❌',
      cleanup_completed:    '🧹',
      replace_completed:    '🔄',
      delete_blocked:       '🚫',
      delete_completed:     '🗑',
      rate_limit_hit:       '⚡',
      ai_alt_generated:     '🤖',
      ai_alt_failed:        '⚠️',
    };
    console.log(`${icon[ev.event] ?? '📊'} [media:${ev.event}]`, entry);
  }

  /* Fire-and-forget webhook */
  if (WEBHOOK_URL) {
    fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET ? { 'Authorization': `Bearer ${WEBHOOK_SECRET}` } : {}),
      },
      body:   JSON.stringify(entry),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { /* non-fatal */ });
  }
}

/** Timer helper for measuring operation durations. */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
