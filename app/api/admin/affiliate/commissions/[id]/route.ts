import { NextResponse } from 'next/server';
import { CommissionStatus } from '@prisma/client';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Body = {
  status?: unknown;
  note?: unknown;
};

const VALID = new Set(Object.values(CommissionStatus));

/**
 * Admin transitions a commission's status. Allowed paths:
 *
 *   PENDING  → APPROVED | REJECTED
 *   APPROVED → PAID | REJECTED
 *   PAID     → (terminal)
 *   REJECTED → (terminal)
 *
 * Terminal-state writes are rejected so a paid-out commission can't be
 * silently flipped back to PENDING. To reverse a payout the admin must
 * issue a separate adjustment (out of scope for MVP).
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (typeof body.status !== 'string' || !VALID.has(body.status as CommissionStatus)) {
    return badRequest('invalid status');
  }
  const next = body.status as CommissionStatus;
  const note =
    typeof body.note === 'string'
      ? body.note.slice(0, 500)
      : body.note === null
        ? null
        : undefined;

  try {
    const current = await prisma.commission.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const allowed: Record<CommissionStatus, CommissionStatus[]> = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['PAID', 'REJECTED'],
      PAID: [],
      REJECTED: []
    };
    if (!allowed[current.status].includes(next)) {
      return badRequest(
        `transition ${current.status}→${next} is not allowed`
      );
    }

    const updated = await prisma.commission.update({
      where: { id },
      data: {
        status: next,
        approvedAt: next === 'APPROVED' ? new Date() : current.approvedAt,
        paidAt: next === 'PAID' ? new Date() : current.paidAt,
        note: note === undefined ? current.note : note
      }
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handlePrismaError(error, 'PATCH /api/admin/affiliate/commissions/[id]');
  }
}
