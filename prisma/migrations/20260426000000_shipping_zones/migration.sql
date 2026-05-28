-- Migration: Add ShippingZone and link from ShippingMethod (PostgreSQL)

CREATE TABLE "ShippingZone" (
  "id"        TEXT PRIMARY KEY,
  "name"      VARCHAR(80) NOT NULL,
  "countries" VARCHAR(8)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(8)[],
  "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ShippingZone_isActive_idx"  ON "ShippingZone"("isActive");
CREATE INDEX "ShippingZone_sortOrder_idx" ON "ShippingZone"("sortOrder");

ALTER TABLE "ShippingMethod" ADD COLUMN "zoneId" TEXT;

ALTER TABLE "ShippingMethod"
  ADD CONSTRAINT "ShippingMethod_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ShippingMethod_zoneId_idx" ON "ShippingMethod"("zoneId");
