import { randomBytes } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Crockford-style alphabet without ambiguous glyphs (no 0/O/1/I/L/U).
 * 8 chars over 30 symbols ≈ 30^8 ≈ 6.5e11 — collisions are vanishingly
 * rare per user, but we still retry on the unique constraint as a
 * defense in depth.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LEN = 8;

function generateCandidate(): string {
  const buf = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * Lazy-allocates a referral code for the user. Idempotent — once a code
 * is set we never rotate it (would invalidate every existing share link).
 *
 * Race-safe: parallel calls might both `generateCandidate` and try to
 * write; the unique constraint on `referralCode` ensures only one wins,
 * and the loser falls back to the persisted value.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true }
  });
  if (!existing) throw new Error('user_not_found');
  if (existing.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCandidate();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: candidate },
        select: { referralCode: true }
      });
      return updated.referralCode!;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Either someone else set the code on this user (re-read), or the
        // candidate collided with another user's code (retry).
        const re = await prisma.user.findUnique({
          where: { id: userId },
          select: { referralCode: true }
        });
        if (re?.referralCode) return re.referralCode;
        continue;
      }
      throw err;
    }
  }
  throw new Error('referral_code_generation_failed');
}
