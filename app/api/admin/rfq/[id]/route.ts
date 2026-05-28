import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { updateRfq } from '@/lib/rfq/service';
import type { UpdateRfqInput } from '@/lib/rfq/types';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<{ status?: string }>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const updated = await updateRfq(id, admin.id, parsed.data as UpdateRfqInput, true);
    if (!updated) return notFound('RFQ not found');
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/admin/rfq/${id}`);
  }
}
