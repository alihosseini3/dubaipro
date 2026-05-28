-- CreateTable
CREATE TABLE "WhatsAppClick" (
    "id"         TEXT NOT NULL,
    "productId"  TEXT,
    "supplierId" TEXT,
    "source"     TEXT NOT NULL DEFAULT 'unknown',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsAppClick_createdAt_idx"  ON "WhatsAppClick"("createdAt");
CREATE INDEX "WhatsAppClick_productId_idx"  ON "WhatsAppClick"("productId");
CREATE INDEX "WhatsAppClick_supplierId_idx" ON "WhatsAppClick"("supplierId");
