import { NextResponse } from 'next/server';

import { dispatchAutomation } from '@/lib/automation/dispatch';
import { buildPersonalVars } from '@/lib/automation/personalize';
import { reclassifyDormantSegments } from '@/lib/customers/metrics';
import { prisma } from '@/lib/prisma';

/**
 * Comeback discount code. Static for now — a later iteration can
 * generate per-user one-time codes by integrating with the coupon
 * service. Kept simple to avoid coupon-pool exhaustion bugs.
 */
const COMEBACK_DISCOUNT_CODE = 'COMEBACK10';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lifecycle cron — call once per hour. Two responsibilities:
 *
 *   1. Send POST_PURCHASE_REMINDER to anyone whose `lastOrderAt` is
 *      in the 7d±1d window AND who hasn't received this reminder yet
 *      for that order date. The window keeps a delayed cron run from
 *      flooding inboxes.
 *
 *   2. Send INACTIVE_COMEBACK to anyone with `lastOrderAt` between
 *      30 and 60 days ago, segment !== HIGH_VALUE (we treat whales
 *      via a different track), and no comeback already sent.
 *
 * Then it reruns segment classification for users that may have
 * crossed boundaries (e.g. REPEAT → INACTIVE).
 *
 * Auth: bearer `CRON_SECRET` matches `app/api/cron/cart-abandonment`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const now = Date.now();
  const day = 86_400_000;

  // ---- 1) D+7 reminder window: 6..8 days post-order, not yet reminded.
  const reminderUpper = new Date(now - 6 * day);
  const reminderLower = new Date(now - 8 * day);

  const reminderTargets = await prisma.userMetrics.findMany({
    where: {
      reminder7At: null,
      lastOrderAt: { gte: reminderLower, lte: reminderUpper }
    },
    select: {
      userId: true,
      lastOrderAt: true,
      user: { select: { name: true, email: true } }
    },
    take: 200
  });

  let remindersSent = 0;
  for (const m of reminderTargets) {
    const personal = await buildPersonalVars(m.userId, {
      discountCode: 'BUNDLE10'
    });
    await dispatchAutomation({
      eventType: 'POST_PURCHASE_REMINDER',
      userId: m.userId,
      dedupeKey: `POST_PURCHASE_REMINDER:${m.userId}:${m.lastOrderAt?.toISOString()}`,
      email: m.user.email,
      vars: {
        name: m.user.name,
        link: `/account/orders`,
        ...personal
      }
    });
    await prisma.userMetrics.update({
      where: { userId: m.userId },
      data: { reminder7At: new Date() }
    });
    remindersSent++;
  }

  // ---- 2) D+30 comeback: 30..60 days dormant, not whales, never sent.
  const comebackUpper = new Date(now - 30 * day);
  const comebackLower = new Date(now - 60 * day);

  const comebackTargets = await prisma.userMetrics.findMany({
    where: {
      comeback30At: null,
      segment: { in: ['NEW', 'REPEAT', 'INACTIVE'] },
      lastOrderAt: { gte: comebackLower, lte: comebackUpper }
    },
    select: {
      userId: true,
      lastOrderAt: true,
      user: { select: { name: true, email: true } }
    },
    take: 200
  });

  let comebackSent = 0;
  for (const m of comebackTargets) {
    const personal = await buildPersonalVars(m.userId, {
      discountCode: COMEBACK_DISCOUNT_CODE
    });
    await dispatchAutomation({
      eventType: 'INACTIVE_COMEBACK',
      userId: m.userId,
      dedupeKey: `INACTIVE_COMEBACK:${m.userId}:${m.lastOrderAt?.toISOString()}`,
      email: m.user.email,
      vars: {
        name: m.user.name,
        link: `/`,
        ...personal
      }
    });
    await prisma.userMetrics.update({
      where: { userId: m.userId },
      data: { comeback30At: new Date() }
    });
    comebackSent++;
  }

  // ---- 3) Reclassify segments that may have shifted.
  const reclassified = await reclassifyDormantSegments();

  return NextResponse.json({
    remindersSent,
    comebackSent,
    reclassified
  });
}
