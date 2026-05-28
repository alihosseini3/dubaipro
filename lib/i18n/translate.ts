import 'server-only';

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';

/**
 * Auto-translation pipeline.
 *
 *   1. `translate(text, target, source?)` checks the `Translation`
 *      cache table first; misses go to the configured provider, the
 *      result is written back to the cache, and the same hash will
 *      never re-hit the provider again.
 *   2. `translateMany` batches multiple strings into a single round
 *      trip — useful for a homepage section that has half a dozen
 *      strings to localise at once.
 *
 * Provider selection is controlled by env:
 *
 *   TRANSLATE_PROVIDER = none | libretranslate | openai
 *   TRANSLATE_API_URL  = upstream base URL (libretranslate)
 *   TRANSLATE_API_KEY  = bearer / api key (libretranslate optional, openai required)
 *   OPENAI_API_KEY     = fallback name for the openai provider
 *
 * When the provider is `none` (or env is missing), the pipeline
 * gracefully echoes the source text back. The DB cache is still
 * consulted, so once an admin manually fills a row the storefront
 * will pick it up without code changes.
 */

export type Locale = string;

type Provider = 'none' | 'libretranslate' | 'openai';

function getProvider(): Provider {
  const raw = (process.env.TRANSLATE_PROVIDER ?? '').toLowerCase().trim();
  if (raw === 'libretranslate' || raw === 'openai' || raw === 'none') return raw;
  // Auto-pick openai if an API key is present, otherwise no-op.
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
}

const SOURCE_LOCALE_DEFAULT =
  (process.env.TRANSLATE_SOURCE_LOCALE ?? 'en').toLowerCase();

/** Stable short hash of (text + sourceLocale). Same input ⇒ same row. */
function hashKey(text: string, sourceLocale: string): string {
  return createHash('sha256')
    .update(`${sourceLocale}::${text}`)
    .digest('hex')
    .slice(0, 32);
}

/** Quick guard so we don't waste a DB round trip on URLs / numbers /
 *  empty strings — they're never meaningful to translate. */
function shouldSkip(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  // pure numbers / amounts
  if (/^[\d\s.,%+-]+$/.test(trimmed)) return true;
  // looks like a URL or path
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^\/[\w/-]*$/i.test(trimmed)) return true;
  // single emoji / glyph
  if (trimmed.length === 1) return true;
  return false;
}

/**
 * Translate a single string. Returns the original text on any
 * failure or skip — callers never have to defensive-code around this.
 */
export async function translate(
  text: string,
  targetLocale: Locale,
  sourceLocale: Locale = SOURCE_LOCALE_DEFAULT
): Promise<string> {
  if (!text || shouldSkip(text)) return text;
  if (targetLocale.toLowerCase() === sourceLocale.toLowerCase()) return text;

  const result = await translateMany([text], targetLocale, sourceLocale);
  return result[0] ?? text;
}

/**
 * Translate an array of strings. Cache is consulted per-item, then
 * the misses are sent to the provider in one call. The output array
 * preserves the input order.
 */
export async function translateMany(
  texts: string[],
  targetLocale: Locale,
  sourceLocale: Locale = SOURCE_LOCALE_DEFAULT
): Promise<string[]> {
  const target = targetLocale.toLowerCase();
  const source = sourceLocale.toLowerCase();
  if (target === source) return texts.slice();

  // Mark which slots actually need translation.
  type Slot = {
    index: number;
    text: string;
    hash: string;
  };
  const slots: Slot[] = [];
  const out: string[] = texts.slice();
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (typeof t !== 'string' || shouldSkip(t)) {
      out[i] = t;
      continue;
    }
    slots.push({ index: i, text: t, hash: hashKey(t, source) });
  }
  if (slots.length === 0) return out;

  // 1) Check cache.
  const cached = await prisma.translation
    .findMany({
      where: {
        targetLocale: target,
        sourceHash: { in: slots.map((s) => s.hash) }
      },
      select: { sourceHash: true, translatedText: true }
    })
    .catch(() => [] as Array<{ sourceHash: string; translatedText: string }>);
  const cacheBySrc = new Map(cached.map((c) => [c.sourceHash, c.translatedText]));

  const misses: Slot[] = [];
  for (const slot of slots) {
    const hit = cacheBySrc.get(slot.hash);
    if (hit !== undefined) {
      out[slot.index] = hit;
    } else {
      misses.push(slot);
    }
  }
  if (misses.length === 0) return out;

  // 2) Call provider for misses.
  const provider = getProvider();
  let translated: string[];
  try {
    translated = await callProvider(
      provider,
      misses.map((m) => m.text),
      target,
      source
    );
  } catch (err) {
    // Total failure: fall back to source text. This keeps the page
    // up even if the provider goes down — admins will see English
    // copy where translation is missing instead of an error.
     
    console.error('[i18n.translate] provider failed:', err);
    translated = misses.map((m) => m.text);
  }

  // Defensive normalisation in case the provider returns the wrong shape.
  if (translated.length !== misses.length) {
    translated = misses.map((m) => m.text);
  }

  // 3) Persist successful translations (skip echoes from `none`).
  const writes = misses
    .map((m, i) => ({ slot: m, value: translated[i] ?? m.text }))
    .filter(({ slot, value }) => value && value !== slot.text)
    .map(({ slot, value }) =>
      prisma.translation.upsert({
        where: {
          sourceHash_targetLocale: {
            sourceHash: slot.hash,
            targetLocale: target
          }
        },
        update: { translatedText: value, provider, sourceText: slot.text },
        create: {
          sourceHash: slot.hash,
          sourceLocale: source,
          targetLocale: target,
          sourceText: slot.text,
          translatedText: value,
          provider
        }
      })
    );
  if (writes.length > 0) {
    await prisma
      .$transaction(writes)
      .catch((err) => console.error('[i18n.translate] cache write failed:', err));
  }

  // 4) Splice translations back into the output.
  for (let i = 0; i < misses.length; i++) {
    out[misses[i].index] = translated[i] ?? misses[i].text;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

async function callProvider(
  provider: Provider,
  texts: string[],
  target: string,
  source: string
): Promise<string[]> {
  switch (provider) {
    case 'none':
      return texts.slice();
    case 'libretranslate':
      return callLibreTranslate(texts, target, source);
    case 'openai':
      return callOpenAI(texts, target, source);
  }
}

async function callLibreTranslate(
  texts: string[],
  target: string,
  source: string
): Promise<string[]> {
  const base = (process.env.TRANSLATE_API_URL ?? '').replace(/\/+$/, '');
  if (!base) return texts.slice();

  const apiKey = process.env.TRANSLATE_API_KEY ?? undefined;

  // Some self-hosted LibreTranslate builds return 400 when `q` is an
  // array (older releases / Argos-only deployments). The most
  // compatible path is one request per string, sent in parallel. For
  // the typical homepage (≤ ~30 strings on a cold cache) this is fine
  // and the cache absorbs every subsequent visit.
  const tasks = texts.map((q) => translateOneLibre(base, q, target, source, apiKey));
  return Promise.all(tasks);
}

async function translateOneLibre(
  base: string,
  q: string,
  target: string,
  source: string,
  apiKey: string | undefined
): Promise<string> {
  const body: Record<string, string> = {
    q,
    source,
    target,
    format: 'text'
  };
  if (apiKey) body.api_key = apiKey;

  const res = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  if (!res.ok) {
    // Pull the response body so the upstream message ("source language
    // not supported", "invalid api key", …) reaches the dev console.
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `LibreTranslate ${res.status}: ${errBody.slice(0, 200) || 'no body'}`
    );
  }
  const json = (await res.json()) as { translatedText?: string };
  return typeof json.translatedText === 'string' ? json.translatedText : q;
}

const OPENAI_MODEL = process.env.TRANSLATE_OPENAI_MODEL ?? 'gpt-4o-mini';

async function callOpenAI(
  texts: string[],
  target: string,
  source: string
): Promise<string[]> {
  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.TRANSLATE_API_KEY;
  if (!apiKey) return texts.slice();

  // We send one prompt per request but ask the model to return JSON
  // so we can preserve the order without doing N round trips.
  const sys = `You are a professional translator. Translate every string in the provided JSON array from ${source} to ${target}. Preserve the meaning, tone and any inline punctuation. Do not translate URLs, brand names ("Dubai Pro", "DubaiPro"), product codes, numbers, currency codes (AED, USD, IRR), or HTML tags. Return ONLY a JSON array of translated strings in the same order, no commentary.`;
  const user = JSON.stringify(texts);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        // We wrap the array in an object so json_object mode is happy.
        // The model is instructed to put the array under `t`.
        {
          role: 'user',
          content:
            'Respond with JSON of the form { "t": [...] }. Input array follows:\n' +
            user
        }
      ]
    }),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned non-JSON content');
  }
  const arr =
    parsed && typeof parsed === 'object' && 't' in parsed
      ? (parsed as { t: unknown }).t
      : parsed;
  if (
    !Array.isArray(arr) ||
    arr.some((x) => typeof x !== 'string') ||
    arr.length !== texts.length
  ) {
    throw new Error('OpenAI returned malformed translation array');
  }
  return arr as string[];
}
