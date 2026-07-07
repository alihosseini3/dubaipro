import { NextRequest, NextResponse } from 'next/server';
import type { SupplierOnboardingStatus } from '@prisma/client';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

const VALID_ONBOARDING = new Set<SupplierOnboardingStatus>(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);
const VALID_ACCOUNT = new Set(['ACTIVE', 'PENDING_REVIEW', 'SUSPENDED', 'BLACKLISTED']);

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = {};

  if (body.onboardingStatus !== undefined) {
    if (!VALID_ONBOARDING.has(body.onboardingStatus as SupplierOnboardingStatus)) {
      return NextResponse.json({ error: 'Invalid onboardingStatus' }, { status: 400 });
    }
    update.onboardingStatus = body.onboardingStatus;
    if (body.onboardingStatus === 'APPROVED') {
      update.status = 'ACTIVE';
    }
  }

  if (body.accountStatus !== undefined) {
    if (!VALID_ACCOUNT.has(body.accountStatus as string)) {
      return NextResponse.json({ error: 'Invalid accountStatus' }, { status: 400 });
    }
    update.status = body.accountStatus;
  }

  if (typeof body.verified === 'boolean') {
    update.verified = body.verified;
  }

  if (typeof body.canListProducts === 'boolean') {
    update.canListProducts = body.canListProducts;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: update,
      select: { id: true, onboardingStatus: true, status: true, verified: true, canListProducts: true },
    });
    return NextResponse.json({ data: supplier });
  } catch {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }
}
