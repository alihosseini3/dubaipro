import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import {
  applySupplierRegistration,
  getSupplierRegistrationState,
  SupplierRegistrationError,
} from '@/lib/supplier/registration-service';
import type { SupplierRegisterPayload } from '@/lib/supplier/registration';

export const runtime = 'nodejs';

/**
 * GET /api/supplier/register
 *
 * Returns the current user's supplier-onboarding state (used by the wizard
 * to resume a saved draft). 401 when not authenticated.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const state = await getSupplierRegistrationState(user.id);
    return NextResponse.json({ data: state });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/register');
  }
}

/**
 * POST /api/supplier/register
 *
 * Multi-step supplier onboarding endpoint. Accepts a partial payload so it
 * doubles as "Save Draft" and final submit:
 *   - Anonymous + `account` block  → creates the account (Step 1) + session.
 *   - Authenticated                → updates the supplier draft.
 *   - `submit: true`               → validates everything and marks PENDING.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody<SupplierRegisterPayload>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  const user = await getCurrentUser();

  try {
    const state = await applySupplierRegistration(user, parsed.data ?? {});
    return NextResponse.json({ data: state }, { status: user ? 200 : 201 });
  } catch (error) {
    if (error instanceof SupplierRegistrationError) {
      return NextResponse.json(
        error.details ? { error: error.message, details: error.details } : { error: error.message },
        { status: error.status }
      );
    }
    return handlePrismaError(error, 'POST /api/supplier/register');
  }
}
