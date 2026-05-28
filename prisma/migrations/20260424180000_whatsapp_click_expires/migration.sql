-- AlterTable
ALTER TABLE "WhatsAppClick" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "WhatsAppClick_expiresAt_idx" ON "WhatsAppClick"("expiresAt");
