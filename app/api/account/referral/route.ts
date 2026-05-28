import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ensureReferralCode } from '@/lib/referral/code';
import { getReferralStats, listMyCommissions } from '@/lib/referral/service';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Allocate the code on first dashboard visit. We do it here (not at
  // signup) so a code is only minted for users who actually want to
  // share — keeps the unique-code namespace lean.
  const code = await ensureReferralCode(user.id);

  const [stats, commissions] = await Promise.all([
    getReferralStats(user.id),
    listMyCommissions(user.id, 100)
  ]);

  return NextResponse.json({
    data: {
      code,
      stats: { ...stats, code },
      commissions
    }
  });
}
