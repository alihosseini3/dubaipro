/**
 * AI Vision provider abstraction for smart alt-text and caption generation.
 *
 * Supported providers (set MEDIA_AI_PROVIDER):
 *   openai  — GPT-4o / gpt-4-vision-preview (MEDIA_AI_API_KEY)
 *   gemini  — Gemini 1.5 Pro Vision (MEDIA_AI_API_KEY)
 *   claude  — Claude 3.5 Sonnet / claude-3-haiku-20240307 (MEDIA_AI_API_KEY)
 *
 * Additional env vars:
 *   MEDIA_AI_MODEL      — override default model
 *   MEDIA_AI_API_KEY    — provider API key
 *   MEDIA_AI_BASE_URL   — custom base URL (Azure OpenAI, Ollama, etc.)
 *   MEDIA_AI_TIMEOUT_MS — request timeout (default 10 000)
 *
 * Returns null when no provider is configured (graceful degradation).
 */

import sharp from 'sharp';

import { getMediaSettings } from './settings';

/* OpenAI, Claude and Gemini all accept these four; anything else (AVIF, HEIC,
 * TIFF, BMP, SVG, …) must be transcoded first. */
const AI_SUPPORTED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

/** Re-encode the buffer to JPEG when the mime type is not natively supported
 *  by the upstream AI providers. Returns the (possibly transcoded) buffer +
 *  effective mime type to use in the request payload. */
async function ensureAiCompatibleImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const mt = (mimeType || '').toLowerCase();
  if (AI_SUPPORTED_MIMES.has(mt)) return { buffer, mimeType: mt };
  try {
    const converted = await sharp(buffer, { failOn: 'none' })
      .rotate()                     // honor EXIF orientation
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return { buffer: converted, mimeType: 'image/jpeg' };
  } catch (err) {
    throw new Error(
      `Image format "${mimeType}" is not supported by the AI provider and could not be transcoded: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export interface VisionResult {
  alt:        string;
  title?:     string;    // SEO image title ~60 chars
  caption?:   string;
  keywords?:  string[];
  objects?:   string[];
  confidence: 'high' | 'medium' | 'low';
  provider:   string;
}

export interface VisionHint {
  context?:            string | null;
  filename?:           string;
  folder?:             string | null;
  productName?:        string | null;
  productDescription?: string | null;
  categoryName?:       string | null;
  brandName?:          string | null;
}

/** Returns true when AI vision is configured (checks DB settings + env). */
export async function isAiVisionEnabled(): Promise<boolean> {
  const s = await getMediaSettings();
  return s.ai.enabled;
}

/** Sync check using only env vars — for places where async is not possible. */
export function isAiVisionEnabledSync(): boolean {
  return !!(process.env.MEDIA_AI_PROVIDER && process.env.MEDIA_AI_API_KEY);
}

/**
 * Generate alt text + title + caption + keywords from an image.
 * Accepts image as Buffer (reliable for localhost) — caller must read the file first.
 * Returns null when no provider is configured.
 */
export async function generateImageMeta(
  image: { buffer: Buffer; mimeType: string },
  hint?: VisionHint,
): Promise<VisionResult | null> {
  const s = await getMediaSettings();
  if (!s.ai.enabled) {
    console.warn('[ai-vision] not configured — set provider/api-key in admin panel');
    return null;
  }

  const { provider, apiKey, model, baseUrl, timeoutMs, useWebSearch } = s.ai;
  const prompt = buildPrompt(hint);

  /* Transcode AVIF/HEIC/TIFF/etc. to JPEG — OpenAI & Claude reject them. */
  const compat   = await ensureAiCompatibleImage(image.buffer, image.mimeType || 'image/jpeg');
  const base64   = compat.buffer.toString('base64');
  const mimeType = compat.mimeType;

  switch (provider) {
    case 'openai': return await openaiVision(base64, mimeType, prompt, apiKey, model, baseUrl, timeoutMs, useWebSearch);
    case 'gemini': return await geminiVision(base64, mimeType, prompt, apiKey, model, baseUrl, timeoutMs, useWebSearch);
    case 'claude': return await claudeVision(base64, mimeType, prompt, apiKey, model, baseUrl, timeoutMs);
    default: return null;
  }
}

/* ── Smart prompt builder ── */
function buildPrompt(hint?: VisionHint): string {
  const lines: string[] = [];

  lines.push(
    'You are an SEO specialist for a B2B e-commerce marketplace based in Dubai (UAE).',
    'Your task: analyze this product/content image and generate accurate, professional SEO metadata.',
    '',
    'CRITICAL RULES:',
    '- Base your analysis ONLY on what you VISUALLY SEE in the image.',
    '- NEVER use the filename as a description — filenames are technical IDs, not descriptions.',
    '- Do NOT say "image of", "picture of", or "photo of".',
    '- Write in English. Be specific and professional.',
    '',
  );

  /* Strong context cues — the AI must trust these as ground truth */
  const hasProduct = !!(hint?.productName);
  const hasFolder  = !!(hint?.folder && hint.folder !== 'general');

  if (hasProduct || hasFolder) {
    lines.push('GROUND-TRUTH CONTEXT (TRUST THIS — it overrides any uncertain visual guess):');
    if (hasProduct) {
      lines.push(`- Product name: ${hint!.productName}`);
      if (hint!.categoryName)  lines.push(`- Category: ${hint!.categoryName}`);
      if (hint!.brandName)     lines.push(`- Brand: ${hint!.brandName}`);
      if (hint!.productDescription) {
        const desc = hint!.productDescription.slice(0, 300);
        lines.push(`- Description: ${desc}`);
      }
    }
    if (hasFolder) {
      lines.push(`- Storage folder / category: "${hint!.folder}" (this is the product category as labeled by the admin)`);
    }
    if (hint?.filename) {
      lines.push(`- Original filename (may contain model number / SKU): "${hint.filename}"`);
    }
    lines.push('');
    lines.push('IMPORTANT: If your visual guess conflicts with this context, prefer the context.');
    lines.push('Example: if the folder is "vape" but the device looks ambiguous, describe it as a vape device, NOT as a smartwatch / phone / camera.');
    lines.push('If you can identify the SPECIFIC brand / model from the image (logo, label, screen UI, distinctive shape), include it in `title` and `keywords`.');
    lines.push('');
  } else if (hint?.filename) {
    lines.push(`Original filename (hint only, may contain model identifiers): "${hint.filename}"`);
    lines.push('');
  }

  if (hint?.context && hint.context !== 'general') {
    const contextLabels: Record<string, string> = {
      'product-cover':   'Main product cover image',
      'product-gallery': 'Product gallery image (additional angle/detail)',
      'hero':            'Hero/banner image',
      'category':        'Category cover image',
      'blog':            'Blog article image',
      'brand':           'Brand logo or identity image',
      'supplier':        'Supplier/company image',
      'avatar':          'Profile/avatar photo',
    };
    const ctxLabel = contextLabels[hint.context] ?? hint.context;
    lines.push(`Image usage context: ${ctxLabel}`, '');
  }

  lines.push(
    'Return a JSON object with EXACTLY these fields:',
    '- "alt": Screen-reader accessibility text. Describe the main subject clearly. Max 125 chars.',
    '- "title": SEO image title. Keyword-rich, concise. Max 60 chars.',
    '- "caption": 1-2 sentences for human readers. Mention visible product features, materials, or use-cases.',
    '- "keywords": Array of 5-10 lowercase SEO keywords/phrases (mix of specific and broad terms).',
    '- "objects": Array of main objects/items you can see in the image.',
    '- "confidence": "high" if subject is clearly identifiable, "medium" if partially, "low" if unclear.',
    '',
    'Return ONLY valid JSON. No markdown fences, no extra text.',
  );

  return lines.join('\n');
}

/* ── OpenAI ── */
async function openaiVision(
  base64: string, mimeType: string, prompt: string,
  apiKey: string, modelOverride: string, baseUrlOverride: string,
  timeoutMs: number, useWebSearch = false,
): Promise<VisionResult | null> {
  const model  = modelOverride || 'gpt-4o-mini';
  const base   = baseUrlOverride || 'https://api.openai.com';
  const dataUri = `data:${mimeType};base64,${base64}`;

  /* ── Responses API with web_search_preview when grounding is enabled ── */
  if (useWebSearch) {
    const res = await fetch(`${base}/v1/responses`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal:  AbortSignal.timeout(Math.max(timeoutMs, 30_000)),
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search_preview' }],
        input: [{
          role: 'user',
          content: [
            { type: 'input_image', image_url: dataUri, detail: 'high' },
            { type: 'input_text',  text: `${prompt}\n\nIMPORTANT: You have web search. Use it to confirm brand/model when the image shows logos, packaging, or screen UI you can read. Then return the same JSON schema.` },
          ],
        }],
        max_output_tokens: 800,
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let hint = '';
      try { const j = JSON.parse(errText); hint = j?.error?.message ?? j?.error?.code ?? ''; } catch { hint = errText.slice(0, 150); }
      throw new Error(`OpenAI [${res.status}]: ${hint || res.statusText}`);
    }
    const data = await res.json() as {
      output_text?: string;
      output?: { type: string; content?: { type: string; text?: string }[] }[];
    };
    let text = data.output_text ?? '';
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c.text === 'string') text += c.text;
          }
        }
      }
    }
    return parseVisionJson(text, 'openai');
  }

  /* ── Default: Chat Completions API ── */
  const res = await fetch(`${base}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    signal:  AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 600,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let hint = '';
    try { const j = JSON.parse(errText); hint = j?.error?.message ?? j?.error?.code ?? ''; } catch { hint = errText.slice(0, 150); }
    throw new Error(`OpenAI [${res.status}]: ${hint || res.statusText}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return parseVisionJson(data.choices?.[0]?.message?.content ?? '', 'openai');
}

/* ── Gemini ── */
async function geminiVision(
  base64: string, mimeType: string, prompt: string,
  apiKey: string, modelOverride: string, baseUrlOverride: string,
  timeoutMs: number, useWebSearch = false,
): Promise<VisionResult | null> {
  const model = modelOverride || 'gemini-1.5-flash';
  const base  = baseUrlOverride || 'https://generativelanguage.googleapis.com';
  const url   = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  /* Gemini 2.x supports `google_search`; 1.5 supports `google_search_retrieval`.
   * Send both — the API ignores the irrelevant key. */
  const tools = useWebSearch
    ? [{ google_search: {}, google_search_retrieval: { dynamic_retrieval_config: { mode: 'MODE_DYNAMIC', dynamic_threshold: 0.3 } } }]
    : undefined;

  const groundedPrompt = useWebSearch
    ? `${prompt}\n\nYou have Google Search. Use it to verify the brand / model / specific product family when the image shows packaging, logos, or distinctive shapes.`
    : prompt;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(Math.max(timeoutMs, useWebSearch ? 30_000 : timeoutMs)),
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: groundedPrompt },
        ],
      }],
      ...(tools ? { tools } : {}),
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let hint = '';
    try { const j = JSON.parse(errText); hint = j?.error?.message ?? j?.error?.status ?? ''; } catch { hint = errText.slice(0, 150); }
    throw new Error(`Gemini [${res.status}]: ${hint || res.statusText}`);
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return parseVisionJson(text, 'gemini');
}

/* ── Claude ── */
async function claudeVision(base64: string, mimeType: string, prompt: string, apiKey: string, modelOverride: string, baseUrlOverride: string, timeoutMs: number): Promise<VisionResult | null> {
  const model = modelOverride || 'claude-3-haiku-20240307';
  const base  = baseUrlOverride || 'https://api.anthropic.com';

  const res = await fetch(`${base}/v1/messages`, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal:  AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let hint = '';
    try { const j = JSON.parse(errText); hint = j?.error?.message ?? j?.error?.type ?? ''; } catch { hint = errText.slice(0, 150); }
    throw new Error(`Claude [${res.status}]: ${hint || res.statusText}`);
  }
  const data = await res.json() as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return parseVisionJson(text, 'claude');
}

/* ── JSON parser ── */
function parseVisionJson(raw: string, provider: string): VisionResult | null {
  try {
    /* Strip markdown code fences if the model wrapped it */
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as {
      alt?: string; title?: string; caption?: string;
      keywords?: string[]; objects?: string[];
      confidence?: string;
    };
    if (typeof parsed.alt !== 'string' || !parsed.alt.trim()) return null;
    const conf = parsed.confidence === 'medium' ? 'medium'
               : parsed.confidence === 'low'    ? 'low'
               : 'high';
    return {
      alt:        parsed.alt.slice(0, 125),
      title:      typeof parsed.title   === 'string' ? parsed.title.slice(0, 60)   : undefined,
      caption:    typeof parsed.caption === 'string' ? parsed.caption.slice(0, 500) : undefined,
      keywords:   Array.isArray(parsed.keywords)
        ? (parsed.keywords as unknown[]).filter((k): k is string => typeof k === 'string').slice(0, 10)
        : undefined,
      objects:    Array.isArray(parsed.objects)
        ? (parsed.objects as unknown[]).filter((o): o is string => typeof o === 'string').slice(0, 12)
        : undefined,
      confidence: conf,
      provider,
    };
  } catch {
    /* If the model returned free-text, treat it as the alt */
    const text = raw.trim().slice(0, 200);
    if (text.length < 5) return null;
    return { alt: text, confidence: 'low', provider };
  }
}
