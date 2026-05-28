import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import {
  computeStats,
  evaluateWinner,
  MIN_VISITORS_PER_VARIANT,
  type VariantStats
} from '@/lib/experiments/stats';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  variants?: unknown;
};

const VARIANT_KEY_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** Shape returned by the raw stats query below. All numerics are bigint
 *  in pg; we coerce to Number on the JS side (revenue caps make this safe). */
type RawStatsRow = {
  variantId: string;
  visitors: bigint | number;
  impressions: bigint | number;
  clicks: bigint | number;
  conversions: bigint | number;
  revenue: Prisma.Decimal | string | number;
  revenue_sq: Prisma.Decimal | string | number;
};

const toN = (v: bigint | number | string | Prisma.Decimal | null | undefined) =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v.toString());

/**
 * Get one experiment with computed result metrics per variant plus a
 * revenue-driven winner verdict.
 *
 * We aggregate in a single raw query because:
 *   - `COUNT(DISTINCT visitorId)` isn't expressible via Prisma groupBy
 *   - we need `SUM(value^2)` for the variance estimator behind the
 *     confidence interval — also not supported by groupBy
 * One round-trip is also faster than the previous two.
 */
export async function GET(_req: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  try {
    const exp = await prisma.experiment.findUnique({
      where: { id },
      include: { variants: { orderBy: { key: 'asc' } } }
    });
    if (!exp) return notFound('experiment not found');

    const rows = await prisma.$queryRaw<RawStatsRow[]>`
      SELECT
        v."id" AS "variantId",
        COUNT(DISTINCT CASE WHEN e."type" = 'IMPRESSION' THEN e."visitorId" END) AS visitors,
        COUNT(CASE WHEN e."type" = 'IMPRESSION' THEN 1 END) AS impressions,
        COUNT(CASE WHEN e."type" = 'CLICK' THEN 1 END) AS clicks,
        COUNT(CASE WHEN e."type" = 'CONVERSION' THEN 1 END) AS conversions,
        COALESCE(SUM(CASE WHEN e."type" = 'CONVERSION' THEN e."value" END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN e."type" = 'CONVERSION' THEN e."value" * e."value" END), 0) AS revenue_sq
      FROM "ExperimentVariant" v
      LEFT JOIN "ExperimentEvent" e
        ON e."variantId" = v."id" AND e."experimentId" = ${id}
      WHERE v."experimentId" = ${id}
      GROUP BY v."id"
    `;

    const byId = new Map(rows.map((r) => [r.variantId, r]));

    const stats = exp.variants.map((v) => {
      const r = byId.get(v.id);
      const raw: VariantStats = {
        variantId: v.id,
        variantKey: v.key,
        variantName: v.name,
        weight: v.weight,
        config: v.config,
        visitors: toN(r?.visitors),
        impressions: toN(r?.impressions),
        clicks: toN(r?.clicks),
        conversions: toN(r?.conversions),
        revenue: toN(r?.revenue),
        revenueSq: toN(r?.revenue_sq)
      };
      return computeStats(raw);
    });

    const verdict = evaluateWinner(stats);

    return NextResponse.json({
      data: {
        ...exp,
        stats,
        verdict,
        minSampleSize: MIN_VISITORS_PER_VARIANT
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/experiments/[id]');
  }
}

/**
 * Edit metadata, toggle active, or replace variants.
 * Variant edits are surgical: existing keys → update weight/name/config;
 * brand-new keys → create; missing keys → delete (cascades events).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 120) {
      return badRequest('invalid name');
    }
    data.name = body.name;
  }
  if (body.description !== undefined) {
    if (body.description === null) data.description = null;
    else if (typeof body.description === 'string' && body.description.length <= 2000) {
      data.description = body.description;
    } else return badRequest('invalid description');
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return badRequest('invalid isActive');
    data.isActive = body.isActive;
  }

  try {
    const existing = await prisma.experiment.findUnique({
      where: { id },
      include: { variants: true }
    });
    if (!existing) return notFound('experiment not found');

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.experiment.update({ where: { id }, data });
      }

      if (Array.isArray(body.variants)) {
        const incomingByKey = new Map<string, { name: string; weight: number; config: unknown }>();
        for (const item of body.variants) {
          if (!item || typeof item !== 'object') throw new Error('invalid variant');
          const v = item as Record<string, unknown>;
          if (typeof v.key !== 'string' || !VARIANT_KEY_RE.test(v.key)) {
            throw new Error('invalid variant key');
          }
          if (incomingByKey.has(v.key)) throw new Error('duplicate variant key');
          if (typeof v.name !== 'string' || v.name.length === 0 || v.name.length > 100) {
            throw new Error('invalid variant name');
          }
          const weight =
            typeof v.weight === 'number' && Number.isFinite(v.weight) && v.weight >= 0
              ? Math.floor(v.weight)
              : 1;
          let config: unknown = {};
          if (v.config !== undefined && v.config !== null) {
            if (typeof v.config !== 'object' || Array.isArray(v.config)) {
              throw new Error('config must be an object');
            }
            config = v.config;
          }
          incomingByKey.set(v.key, { name: v.name, weight, config });
        }

        const existingByKey = new Map(existing.variants.map((v) => [v.key, v]));

        // delete removed
        for (const [key, v] of existingByKey) {
          if (!incomingByKey.has(key)) {
            await tx.experimentVariant.delete({ where: { id: v.id } });
          }
        }
        // upsert remaining
        for (const [key, payload] of incomingByKey) {
          const prev = existingByKey.get(key);
          if (prev) {
            await tx.experimentVariant.update({
              where: { id: prev.id },
              data: {
                name: payload.name,
                weight: payload.weight,
                config: payload.config as never
              }
            });
          } else {
            await tx.experimentVariant.create({
              data: {
                experimentId: id,
                key,
                name: payload.name,
                weight: payload.weight,
                config: payload.config as never
              }
            });
          }
        }
      }
    });

    const fresh = await prisma.experiment.findUnique({
      where: { id },
      include: { variants: { orderBy: { key: 'asc' } } }
    });
    return NextResponse.json({ data: fresh });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('invalid') ) {
      return badRequest(error.message);
    }
    if (error instanceof Error && (error.message.includes('duplicate') || error.message.includes('config must'))) {
      return badRequest(error.message);
    }
    return handlePrismaError(error, 'PATCH /api/admin/experiments/[id]');
  }
}

/**
 * Permanently delete an experiment and all its events.
 * Cascade is configured at the schema level.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  try {
    await prisma.experiment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/experiments/[id]');
  }
}
