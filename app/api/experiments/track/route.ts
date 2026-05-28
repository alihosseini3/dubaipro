import { NextResponse } from 'next/server';

import { parseJsonBody } from '@/lib/api/validation';
import { trackExperimentEvent } from '@/lib/experiments/track';
import { getVisitorId } from '@/lib/experiments/visitor';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

type Body = {
  experimentId?: unknown;
  variantId?: unknown;
  type?: unknown;
  value?: unknown;
};

const ALLOWED = new Set(['IMPRESSION', 'CLICK', 'CONVERSION']);

/**
 * Public tracking endpoint used by the client `<Experiment>` wrapper.
 * Always returns 204 (even on bad input) so a misbehaving page never
 * gets stuck retrying — analytics is best-effort.
 */
export async function POST(request: Request) {
  const ok = new NextResponse(null, { status: 204 });

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return ok;

  const { experimentId, variantId, type, value } = parsed.data;
  if (
    typeof experimentId !== 'string' ||
    typeof variantId !== 'string' ||
    typeof type !== 'string' ||
    !ALLOWED.has(type)
  ) {
    return ok;
  }

  const visitorId = await getVisitorId();
  if (!visitorId) return ok;

  const user = await getCurrentUser().catch(() => null);

  await trackExperimentEvent({
    experimentId,
    variantId,
    type: type as 'IMPRESSION' | 'CLICK' | 'CONVERSION',
    visitorId,
    userId: user?.id ?? null,
    value: typeof value === 'number' ? value : 0
  });

  return ok;
}
