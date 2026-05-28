import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { adminRejectPayment } from '@/lib/payments/service';
import { PaymentError } from '@/lib/payments/types';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const parsed = await parseJsonBody<{ reason?: string }>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  try {
    const data = await adminRejectPayment(id, parsed.data.reason ?? '');
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    console.error('reject payment failed:', err);
    return serverError();
  }
}
