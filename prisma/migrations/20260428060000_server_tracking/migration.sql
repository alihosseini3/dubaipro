-- Server-side tracking secrets + per-user consent timestamp.
ALTER TABLE "MarketingSettings"
  ADD COLUMN IF NOT EXISTS "metaAccessToken" TEXT,
  ADD COLUMN IF NOT EXISTS "metaTestEventCode" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "ga4MeasurementId" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "ga4ApiSecret" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
