import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const REF_COOKIE = 'ref';
export const REF_COOKIE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Validate a `?ref=` value before we trust it as a code. Codes are
 * uppercase Crockford-ish — anything else is silently dropped so we
 * never persist attacker-controlled junk in cookies.
 */
const CODE_RE = /^[A-Z0-9]{4,16}$/;
export function isValidCodeShape(raw: string): boolean {
  return CODE_RE.test(raw);
}

/**
 * Attempt to attach a freshly registered user to a referrer.
 *
 * Anti-fraud guarantees enforced here:
 *  - self-referral by code: referrer.id must differ from new user
 *  - self-referral by email: referrer.email must differ (catches the
 *    "make a 2nd account on my own link" pattern)
 *  - re-attribution: `referredUserId` is unique → second call no-ops
 *  - unknown code: silently ignored (don't leak code existence)
 *
 * Never throws — referral linking is best-effort and must not break
 * registration.
 */
export async function linkReferralOnSignup(args: {
  newUserId: string;
  newUserEmail: string;
  code: string | null | undefined;
}): Promise<{ linked: boolean; reason?: string }> {
  const code = args.code?.trim().toUpperCase();
  if (!code || !isValidCodeShape(code)) return { linked: false, reason: 'no_code' };

  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, email: true }
    });
    if (!referrer) return { linked: false, reason: 'unknown_code' };
    if (referrer.id === args.newUserId) {
      return { linked: false, reason: 'self_referral' };
    }
    if (referrer.email.toLowerCase() === args.newUserEmail.toLowerCase()) {
      return { linked: false, reason: 'self_referral_email' };
    }

    await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: args.newUserId,
        code
      }
    });
    return { linked: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // Already linked (possible on signup retries) — treat as success.
      return { linked: false, reason: 'already_linked' };
    }
    // eslint-disable-next-line no-console
    console.error('[referral] linkReferralOnSignup failed', err);
    return { linked: false, reason: 'error' };
  }
}

export type ReferralStats = {
  code: string | null;
  totalReferred: number;
  totalEarned: { currency: string; amount: number }[];
  pending: { currency: string; amount: number }[];
  paid: { currency: string; amount: number }[];
};

/**
 * Aggregate stats for the user's affiliate dashboard. Buckets by
 * currency because orders may be priced in AED/USD/etc. and converting
 * to a single base here would lose precision and make payouts
 * ambiguous.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [user, referredCount, grouped] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true }
    }),
    prisma.referral.count({ where: { referrerUserId: userId } }),
    prisma.commission.groupBy({
      by: ['currency', 'status'],
      where: { referrerUserId: userId },
      _sum: { amount: true }
    })
  ]);

  const totals = new Map<string, number>();
  const pending = new Map<string, number>();
  const paid = new Map<string, number>();

  for (const row of grouped) {
    const amount = Number(row._sum.amount ?? 0);
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + amount);
    if (row.status === 'PENDING' || row.status === 'APPROVED') {
      pending.set(row.currency, (pending.get(row.currency) ?? 0) + amount);
    } else if (row.status === 'PAID') {
      paid.set(row.currency, (paid.get(row.currency) ?? 0) + amount);
    }
  }

  const flatten = (m: Map<string, number>) =>
    [...m.entries()].map(([currency, amount]) => ({ currency, amount }));

  return {
    code: user?.referralCode ?? null,
    totalReferred: referredCount,
    totalEarned: flatten(totals),
    pending: flatten(pending),
    paid: flatten(paid)
  };
}

export async function listMyCommissions(userId: string, take = 50) {
  return prisma.commission.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      orderId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      paidAt: true
    }
  });
}
