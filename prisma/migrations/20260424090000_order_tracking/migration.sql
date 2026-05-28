-- AlterTable: add tracking fields + updatedAt on Order
ALTER TABLE "Order"
  ADD COLUMN "trackingCode" VARCHAR(64),
  ADD COLUMN "carrier"      VARCHAR(64),
  ADD COLUMN "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill updatedAt from createdAt for existing rows, then drop the
-- default so future writes go through Prisma's @updatedAt handler.
UPDATE "Order" SET "updatedAt" = "createdAt";
ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Useful index for sorting / "recently updated" admin queries
CREATE INDEX "Order_updatedAt_idx" ON "Order"("updatedAt");
