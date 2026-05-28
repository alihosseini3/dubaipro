import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { acceptQuote, rejectQuote, withdrawQuote } from '@/lib/rfq/quotes';

export const runtime = 'nodejs';

type ActionBody = { action: 'accept' | 'reject' | 'withdraw' };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; quoteId: string }> }
) {
  const { quoteId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<ActionBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { action } = parsed.data;

  if (!['accept', 'reject', 'withdraw'].includes(action)) {
    return badRequest('action must be accept | reject | withdraw');
  }

  try {
    let result: { ok: boolean; error?: string };

    if (action === 'withdraw') {
      const supplier = await prisma.supplier.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!supplier) return NextResponse.json({ error: 'not_a_supplier' }, { status: 403 });
      result = await withdrawQuote(quoteId, supplier.id);
    } else if (action === 'accept') {
      result = await acceptQuote(quoteId, user.id);
    } else {
      result = await rejectQuote(quoteId, user.id);
    }

    if (!result.ok) {
      if (result.error === 'quote_not_found') return notFound('Quote not found');
      if (result.error === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      return badRequest(result.error ?? 'failed');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/rfq/requests/*/quotes/${quoteId}`);
  }
}
