import 'server-only';

import { prisma } from '@/lib/prisma';

type TrackInput = {
  experimentId: string;
  variantId: string;
  type: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
  visitorId: string;
  userId?: string | null;
  value?: number;
};

/**
 * Append-only event recorder. Errors are swallowed: tracking must never
 * break the user-facing flow it's instrumenting (e.g. a failed insert
 * during a payment webhook should not abort the order).
 */
export async function trackExperimentEvent(input: TrackInput): Promise<void> {
  try {
    await prisma.experimentEvent.create({
      data: {
        experimentId: input.experimentId,
        variantId: input.variantId,
        type: input.type,
        visitorId: input.visitorId.slice(0, 64),
        userId: input.userId ?? null,
        value: input.value && Number.isFinite(input.value) ? input.value : 0
      }
    });
  } catch {
    // Intentionally silent — see docstring.
  }
}

/**
 * Record a CONVERSION for every active experiment a visitor was bucketed
 * into. Useful from the order-paid path: we don't know which experiments
 * the visitor saw, so we attribute revenue to whichever arm they'd be
 * deterministically assigned to right now (same hash, so consistent with
 * what they actually saw).
 */
export async function trackConversionForAllActive(
  visitorId: string,
  value: number,
  userId?: string | null
): Promise<void> {
  if (!visitorId) return;

  const { pickVariant } = await import('./assign');
  let experiments: {
    id: string;
    key: string;
    variants: { id: string; key: string; weight: number; config: unknown }[];
  }[] = [];
  try {
    experiments = await prisma.experiment.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        variants: {
          select: { id: true, key: true, weight: true, config: true }
        }
      }
    });
  } catch {
    return;
  }

  await Promise.all(
    experiments.map(async (exp) => {
      const v = pickVariant(exp.variants, visitorId, exp.key);
      if (!v) return;
      await trackExperimentEvent({
        experimentId: exp.id,
        variantId: v.id,
        type: 'CONVERSION',
        visitorId,
        userId: userId ?? null,
        value
      });
    })
  );
}
