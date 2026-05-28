-- AlterTable
ALTER TABLE "WhatsAppClick" ADD COLUMN "utmSource"   TEXT;
ALTER TABLE "WhatsAppClick" ADD COLUMN "utmMedium"   TEXT;
ALTER TABLE "WhatsAppClick" ADD COLUMN "utmCampaign" TEXT;

CREATE INDEX "WhatsAppClick_utmCampaign_idx" ON "WhatsAppClick"("utmCampaign");
CREATE INDEX "WhatsAppClick_utmSource_idx"   ON "WhatsAppClick"("utmSource");
