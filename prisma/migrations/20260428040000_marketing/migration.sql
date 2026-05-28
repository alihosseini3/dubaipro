-- CreateTable
CREATE TABLE "MarketingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleAdsId" TEXT,
    "googleConvLabel" TEXT,
    "metaPixelId" TEXT,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "MarketingSettings" ("id","trackingEnabled","requireConsent","updatedAt")
VALUES ('default', false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
