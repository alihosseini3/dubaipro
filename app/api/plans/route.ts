import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { listPlans } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

/** GET /api/plans — active plans for the public comparison table. */
export const GET = createRoute({ auth: 'public' }, async () => {
  const plans = await listPlans();
  return NextResponse.json({ data: plans });
});
