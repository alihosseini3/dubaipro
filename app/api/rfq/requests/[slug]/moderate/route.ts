import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { transitionRfq, RfqWorkflowError, RfqPermissionError } from '@/lib/rfq/workflow';

export const runtime = 'nodejs';

type ModerateBody = { action: 'approve' | 'reject'; reason?: string };

/**
 * POST /api/rfq/requests/[slug]/moderate  — admin only.
 *
 * Moderation queue actions for RFQs awaiting review:
 *   - approve → PENDING_REVIEW → OPEN  (publish to marketplace)
 *   - reject  → PENDING_REVIEW → CANCELLED (with reason)
 *
 * Transitions go through the workflow engine, so each is validated,
 * audited, and emits an outbox event.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = await parseJsonBody<ModerateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { action, reason } = parsed.data;
  if (action !== 'approve' && action !== 'reject') {
    return badRequest("action must be 'approve' or 'reject'");
  }

  try {
    const rfq = await prisma.rfqRequest.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!rfq) return notFound('RFQ not found');
    if (rfq.status !== 'PENDING_REVIEW') {
      return badRequest('RFQ is not awaiting review');
    }

    const target = action === 'approve' ? 'OPEN' : 'CANCELLED';
    await transitionRfq(
      rfq.id,
      target,
      { id: admin.id, role: 'admin' },
      `moderate:${action}`,
      { reason: reason?.slice(0, 500) }
    );

    return NextResponse.json({ ok: true, status: target });
  } catch (error) {
    if (error instanceof RfqWorkflowError || error instanceof RfqPermissionError) {
      return badRequest(error.message);
    }
    return handlePrismaError(error, `POST /api/rfq/requests/${slug}/moderate`);
  }
}
