-- Extend AutomationEventType with lifecycle events.
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'FIRST_PURCHASE_UPSELL';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'POST_PURCHASE_REMINDER';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'INACTIVE_COMEBACK';

-- CreateEnum
CREATE TYPE "CustomerSegment" AS ENUM ('NEW', 'REPEAT', 'HIGH_VALUE', 'INACTIVE');

-- CreateTable
CREATE TABLE "UserMetrics" (
    "userId" TEXT NOT NULL,
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lifetimeValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "segment" "CustomerSegment" NOT NULL DEFAULT 'NEW',
    "reminder7At" TIMESTAMP(3),
    "comeback30At" TIMESTAMP(3),
    "upsellAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserMetrics_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserMetrics_segment_idx" ON "UserMetrics"("segment");
CREATE INDEX "UserMetrics_lastOrderAt_idx" ON "UserMetrics"("lastOrderAt");
CREATE INDEX "UserMetrics_lifetimeValue_idx" ON "UserMetrics"("lifetimeValue");

-- AddForeignKey
ALTER TABLE "UserMetrics" ADD CONSTRAINT "UserMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing customers from PAID orders (one-time, idempotent on user id).
INSERT INTO "UserMetrics" ("userId","totalSpent","lifetimeValue","orderCount","firstOrderAt","lastOrderAt","segment","computedAt","updatedAt")
SELECT
  o."userId",
  COALESCE(SUM(o."totalPrice"), 0),
  COALESCE(SUM(o."totalPrice"), 0),
  COUNT(*)::int,
  MIN(o."paidAt"),
  MAX(o."paidAt"),
  'NEW',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."paymentStatus" = 'PAID'
GROUP BY o."userId"
ON CONFLICT ("userId") DO NOTHING;
