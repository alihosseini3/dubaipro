import { NextResponse } from 'next/server';

import { handlePrismaError, notFound, badRequest } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import {
  computeStats,
  evaluateWinner,
  type VariantStats
} from '@/lib/experiments/stats';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type RawRow = {
  variantId: string;
  visitors: bigint | number;
  impressions: bigint | number;
  clicks: bigint | number;
  conversions: bigint | number;
  revenue: string | number;
  revenue_sq: string | number;
};
const toN = (v: bigint | number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v.toString());

/**
 * Roll the experiment forward onto its winning variant.
 *
 * Behaviour:
 *   - Server re-runs the verdict on fresh stats so a stale UI can't
 *     promote the wrong arm.
 *   - We refuse to act unless `verdict.shouldApply` is true (≥ 100
 *     visitors per variant AND ≥ 95% confidence on revenue lift).
 *   - The winner gets weight = 1, every other variant gets weight = 0.
 *     Keeping the rows around (instead of deleting them) preserves
 *     historical event attribution and lets an admin reverse course.
 */
export async function POST(_req: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const exp = await prisma.experiment.findUnique({
      where: { id },
      include: { variants: true }
    });
    if (!exp) return notFound('experiment not found');

    const rows = await prisma.$queryRaw<RawRow[]>`
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
    if (!verdict.shouldApply || !verdict.winnerId) {
      return badRequest('insufficient confidence — winner not yet decisive');
    }

    await prisma.$transaction(
      exp.variants.map((v) =>
        prisma.experimentVariant.update({
          where: { id: v.id },
          data: { weight: v.id === verdict.winnerId ? 1 : 0 }
        })
      )
    );

    return NextResponse.json({
      data: { winnerId: verdict.winnerId, confidence: verdict.confidence }
    });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/experiments/[id]/apply-winner');
  }
}
