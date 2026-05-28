import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { submitManualPayment } from '@/lib/payments/service';
import { PaymentError } from '@/lib/payments/types';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = {
  paymentId?: unknown;
  referenceNumber?: unknown;
  receiptImage?: unknown;
};

/**
 * POST /api/payment/manual
 *
 * The customer submits a tracking reference and/or receipt image for a
 * CARD_TRANSFER / BANK_TRANSFER payment. The payment moves to
 * MANUAL_REVIEW so admins can verify it on `/admin/payments`.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  const { paymentId, referenceNumber, receiptImage } = parsed.data;
  if (typeof paymentId !== 'string' || !paymentId) {
    return badRequest('paymentId is required');
  }
  try {
    const data = await submitManualPayment({
      paymentId,
      userId: user.id,
      isAdmin: user.role === 'ADMIN',
      referenceNumber:
        typeof referenceNumber === 'string' ? referenceNumber : null,
      receiptImage: typeof receiptImage === 'string' ? receiptImage : null
    });
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('POST /api/payment/manual failed:', err);
    return serverError();
  }
}
