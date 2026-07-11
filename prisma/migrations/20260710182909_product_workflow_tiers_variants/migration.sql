-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductPriceTier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "leadTimeDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "moq" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" VARCHAR(2048),
    "mediaAssetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPriceTier_productId_idx" ON "ProductPriceTier"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPriceTier_productId_currency_minQty_key" ON "ProductPriceTier"("productId", "currency", "minQty");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");

-- CreateIndex
CREATE INDEX "Product_status_submittedAt_idx" ON "Product"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Product_supplierId_status_idx" ON "Product"("supplierId", "status");

-- AddForeignKey
ALTER TABLE "ProductPriceTier" ADD CONSTRAINT "ProductPriceTier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: products that were already live keep their visibility.
-- isPublished=true → APPROVED (treated as grandfathered-approved);
-- everything else stays DRAFT (the column default).
UPDATE "Product" SET "status" = 'APPROVED', "reviewedAt" = NOW()
WHERE "isPublished" = true;
