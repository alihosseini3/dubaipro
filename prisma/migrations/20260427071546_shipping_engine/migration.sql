-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingBreakdown" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "shippingClass" VARCHAR(32) DEFAULT 'normal',
ADD COLUMN     "weight" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ShippingMethod" ADD COLUMN     "basePrice" DECIMAL(12,2),
ADD COLUMN     "maxWeight" DOUBLE PRECISION,
ADD COLUMN     "minWeight" DOUBLE PRECISION,
ADD COLUMN     "pricePerKg" DECIMAL(12,2),
ADD COLUMN     "shippingClass" VARCHAR(32),
ADD COLUMN     "volumetricFactor" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ShippingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultVolumetricFactor" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "enableVolumetric" BOOLEAN NOT NULL DEFAULT false,
    "roundingStrategy" VARCHAR(16) NOT NULL DEFAULT 'ceil',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingSettings_pkey" PRIMARY KEY ("id")
);
