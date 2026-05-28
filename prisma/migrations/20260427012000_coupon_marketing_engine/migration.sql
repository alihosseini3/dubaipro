-- Enum for scope
CREATE TYPE "CouponAppliesTo" AS ENUM ('ALL', 'CATEGORY', 'PRODUCT', 'USER');

-- Extend Coupon
ALTER TABLE "Coupon"
  ADD COLUMN "appliesTo"      "CouponAppliesTo" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "categoryId"     TEXT,
  ADD COLUMN "productId"      TEXT,
  ADD COLUMN "userId"         TEXT,
  ADD COLUMN "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "perUserLimit"   INTEGER,
  ADD COLUMN "startAt"        TIMESTAMP(3),
  ADD COLUMN "autoApply"      BOOLEAN NOT NULL DEFAULT false;

-- FKs (SetNull on parent delete; coupons keep working)
ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Coupon_productId_fkey"  FOREIGN KEY ("productId")  REFERENCES "Product"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Coupon_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "User"("id")     ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Coupon_startAt_idx"             ON "Coupon"("startAt");
CREATE INDEX "Coupon_autoApply_isActive_idx"  ON "Coupon"("autoApply", "isActive");
CREATE INDEX "Coupon_categoryId_idx"          ON "Coupon"("categoryId");
CREATE INDEX "Coupon_productId_idx"           ON "Coupon"("productId");
CREATE INDEX "Coupon_userId_idx"              ON "Coupon"("userId");

-- Usage history
CREATE TABLE "CouponUsage" (
    "id"        TEXT NOT NULL,
    "couponId"  TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "usedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponUsage_orderId_key"      ON "CouponUsage"("orderId");
CREATE INDEX        "CouponUsage_couponId_idx"     ON "CouponUsage"("couponId");
CREATE INDEX        "CouponUsage_userId_idx"       ON "CouponUsage"("userId");
CREATE INDEX        "CouponUsage_couponId_userId"  ON "CouponUsage"("couponId", "userId");

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CouponUsage_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CouponUsage_orderId_fkey"  FOREIGN KEY ("orderId")  REFERENCES "Order"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing orders with a couponId get a CouponUsage row so
-- per-user limits + history reflect prior redemptions correctly.
INSERT INTO "CouponUsage" ("id", "couponId", "userId", "orderId", "usedAt")
SELECT
  -- cuid-ish unique id; safe enough for backfill, never user-facing
  'bf_' || REPLACE("Order"."id", '-', ''),
  "Order"."couponId",
  "Order"."userId",
  "Order"."id",
  "Order"."createdAt"
FROM "Order"
WHERE "Order"."couponId" IS NOT NULL
ON CONFLICT ("orderId") DO NOTHING;
