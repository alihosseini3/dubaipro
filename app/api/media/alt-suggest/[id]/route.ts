/**
 * GET /api/media/alt-suggest/[id]
 *
 * Rule-based alt text suggestion engine.
 * Architecture is designed so an AI backend (OpenAI vision, etc.) can be
 * wired in via MEDIA_AI_ALT_ENDPOINT env var without changing the contract.
 *
 * Priority:
 *   1. If MEDIA_AI_ALT_ENDPOINT is set → proxy to AI service
 *   2. Otherwise → deterministic suggestion from filename + context + tags
 *
 * Response: { suggestion: string; confidence: 'ai' | 'rule-based' }
 */

import { NextResponse } from 'next/server';

import { handlePrismaError, notFound } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { generateImageMeta, isAiVisionEnabled } from '@/lib/media/ai-vision';
import { readImageBuffer } from '@/lib/media/read-image';
import { altSuggestLimiter } from '@/lib/media/rate-limit';
import { emitMediaEvent } from '@/lib/observability/media-events';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/* ── rule-based suggestion ── */
function ruleBasedAlt(opts: {
  originalName: string;
  context:      string | null | undefined;
  tags:         string[];
  title:        string | null | undefined;
  folder:       string;
}): string {
  const { originalName, context, tags, title, folder } = opts;

  if (title?.trim()) return title.trim();

  /* Clean filename: remove extension, hashes, dashes, underscores */
  const stripped = originalName
    .replace(/\.[^.]+$/, '')                     // extension
    .replace(/[-_]([a-f0-9]{6,})$/i, '')         // trailing hash
    .replace(/[-_](thumb|original|sm|md|lg|xl|2xl|webp|avif|jpeg|jpg|png)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts: string[] = [];

  /* Context prefix */
  const contextLabels: Record<string, string> = {
    'product-cover':   '',
    'product-gallery': '',
    'hero':            'Hero image',
    'hero-banner':     'Hero banner',
    'category':        'Category',
    'category-grid':   'Category',
    'blog':            'Blog article image',
    'blog-cover':      'Blog article cover',
    'brand':           'Brand logo',
    'supplier':        'Supplier logo',
    'avatar':          '',
    'banner':          'Banner',
  };
  const ctxLabel = context ? (contextLabels[context] ?? '') : '';

  if (stripped.length >= 3) {
    parts.push(stripped.charAt(0).toUpperCase() + stripped.slice(1));
  }
  if (ctxLabel) parts.unshift(ctxLabel);
  if (parts.length === 0 && folder !== 'general') {
    parts.push(folder.charAt(0).toUpperCase() + folder.slice(1).replace(/-/g, ' '));
  }
  if (tags.length > 0) {
    parts.push(`— ${tags.slice(0, 3).join(', ')}`);
  }

  return parts.join(' ').slice(0, 200) || 'Image';
}


export async function GET(_req: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const key = `uid:${admin.id}`;
  if (!altSuggestLimiter.allow(key)) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  const { id } = await ctx.params;

  try {
    const asset = await prisma.mediaAsset.findUnique({
      where:  { id },
      select: { id: true, url: true, originalName: true, context: true, tags: true, title: true, folder: true, mimeType: true },
    });
    if (!asset) return notFound('Asset not found');

    /* Skip non-images */
    if (!asset.mimeType.startsWith('image/')) {
      return NextResponse.json({ suggestion: asset.originalName, confidence: 'rule-based' });
    }

    /* ── Resolve product/entity context from usages ── */
    let productName:        string | null = null;
    let productDescription: string | null = null;
    let categoryName:       string | null = null;
    let brandName:          string | null = null;

    try {
      const usage = await prisma.mediaUsage.findFirst({
        where: { assetId: id, entityType: 'product' },
        select: { entityId: true },
      });
      if (usage?.entityId) {
        const product = await prisma.product.findUnique({
          where:  { id: usage.entityId },
          select: { title: true, description: true, category: { select: { name: true } }, brand: { select: { name: true } } },
        });
        if (product) {
          productName        = product.title;
          productDescription = product.description?.slice(0, 400) ?? null;
          categoryName       = product.category?.name ?? null;
          brandName          = product.brand?.name ?? null;
        }
      }
    } catch { /* non-fatal: product context enrichment is best-effort */ }

    const aiConfigured = await isAiVisionEnabled();

    /* ── Try AI Vision ── */
    if (aiConfigured) {
      const buffer = await readImageBuffer(asset.url);
      if (!buffer) {
        return NextResponse.json({
          suggestion:   ruleBasedAlt({ originalName: asset.originalName, context: asset.context, tags: asset.tags, title: asset.title ?? productName, folder: asset.folder }),
          confidence:   'rule-based',
          context:      'error',
          aiConfigured: true,
          error:        `Cannot read image file from ${asset.url}`,
        });
      }

      let aiResult = null;
      let aiError: string | null = null;
      try {
        aiResult = await generateImageMeta(
          { buffer, mimeType: asset.mimeType },
          { context: asset.context, folder: asset.folder, filename: asset.originalName, productName, productDescription, categoryName, brandName },
        );
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
        console.error('[alt-suggest] AI error:', aiError);
      }

      if (aiResult) {
        emitMediaEvent({
          event:   'ai_alt_generated',
          assetId: id,
          userId:  admin.id,
          meta:    { provider: aiResult.provider, confidence: aiResult.confidence, hasProductContext: !!productName },
        });
        return NextResponse.json({
          suggestion:   aiResult.alt,
          title:        aiResult.title   ?? null,
          caption:      aiResult.caption ?? null,
          keywords:     aiResult.keywords ?? [],
          objects:      aiResult.objects  ?? [],
          confidence:   aiResult.confidence,
          provider:     aiResult.provider,
          context:      'ai',
          aiConfigured: true,
          productName,
        });
      }

      /* AI is configured but failed — return rule-based with real error message */
      return NextResponse.json({
        suggestion:   ruleBasedAlt({ originalName: asset.originalName, context: asset.context, tags: asset.tags, title: asset.title ?? productName, folder: asset.folder }),
        confidence:   'rule-based',
        context:      'error',
        aiConfigured: true,
        error:        aiError ?? 'AI provider returned no result. Check API key, model, or quota in 🛠 Tools.',
      });
    }

    /* ── Rule-based fallback (AI not configured) ── */
    const suggestion = ruleBasedAlt({
      originalName: asset.originalName,
      context:      asset.context,
      tags:         asset.tags,
      title:        asset.title ?? productName,
      folder:       asset.folder,
    });

    return NextResponse.json({
      suggestion,
      confidence:   'rule-based',
      context:      'rule-based',
      aiConfigured: false,
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/media/alt-suggest/[id]');
  }
}
