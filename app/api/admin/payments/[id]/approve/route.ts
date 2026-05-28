import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { adminApprovePayment } from '@/lib/payments/service';
import { PaymentError } from '@/lib/payments/types';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  try {
    const data = await adminApprovePayment(id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('approve payment failed:', err);
    return serverError();
  }
}
