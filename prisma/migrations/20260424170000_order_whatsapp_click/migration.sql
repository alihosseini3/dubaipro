-- AlterTable
ALTER TABLE "Order" ADD COLUMN "whatsappClickId" VARCHAR(64);

CREATE INDEX "Order_whatsappClickId_idx" ON "Order"("whatsappClickId");
