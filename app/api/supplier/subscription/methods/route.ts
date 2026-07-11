import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { getPaymentMethods } from '@/lib/payments/methods';

export const runtime = 'nodejs';

/** GET /api/supplier/subscription/methods — enabled payment methods. */
export const GET = createRoute(
  { auth: 'supplier', permission: 'supplier.subscription.view' },
  async () => {
    const methods = (await getPaymentMethods()).filter((m) => m.enabled);
    return NextResponse.json({
      data: methods.map((m) => ({
        code: m.code,
        kind: m.kind,
        i18nKey: m.i18nKey,
        logo: m.logo ?? null
      }))
    });
  }
);
