/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SupplierTier" AS ENUM ('STANDARD', 'VERIFIED', 'GUARANTEED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('MANUFACTURER', 'TRADING_COMPANY', 'DISTRIBUTOR', 'WHOLESALER', 'AGENT', 'OTHER');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "bannerUrl" VARCHAR(2048),
ADD COLUMN     "businessType" "BusinessType",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "exportMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "followerCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoUrl" VARCHAR(2048),
ADD COLUMN     "metaDescription" VARCHAR(200),
ADD COLUMN     "metaTitle" VARCHAR(70),
ADD COLUMN     "minOrderQuantity" INTEGER,
ADD COLUMN     "profileViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingNotes" TEXT,
ADD COLUMN     "shortTagline" VARCHAR(160),
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" "SupplierStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "tier" "SupplierTier" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ADD COLUMN     "warehouseAddress" TEXT,
ADD COLUMN     "yearEstablished" INTEGER;

-- CreateTable
CREATE TABLE "SupplierCertification" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200),
    "fileUrl" VARCHAR(2048) NOT NULL,
    "thumbUrl" VARCHAR(2048),
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierFollower" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReview" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "comment" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "supplierReplyContent" TEXT,
    "supplierReplyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierVerificationLog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fromTier" "SupplierTier",
    "toTier" "SupplierTier",
    "fromStatus" "SupplierStatus",
    "toStatus" "SupplierStatus",
    "action" VARCHAR(64) NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierCertification_supplierId_status_idx" ON "SupplierCertification"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierCertification_supplierId_order_idx" ON "SupplierCertification"("supplierId", "order");

-- CreateIndex
CREATE INDEX "SupplierCertification_type_idx" ON "SupplierCertification"("type");

-- CreateIndex
CREATE INDEX "SupplierFollower_userId_createdAt_idx" ON "SupplierFollower"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierFollower_supplierId_createdAt_idx" ON "SupplierFollower"("supplierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierFollower_supplierId_userId_key" ON "SupplierFollower"("supplierId", "userId");

-- CreateIndex
CREATE INDEX "SupplierReview_supplierId_createdAt_idx" ON "SupplierReview"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierReview_rating_idx" ON "SupplierReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReview_supplierId_userId_key" ON "SupplierReview"("supplierId", "userId");

-- CreateIndex
CREATE INDEX "SupplierVerificationLog_supplierId_createdAt_idx" ON "SupplierVerificationLog"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierVerificationLog_action_idx" ON "SupplierVerificationLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Supplier_tier_status_idx" ON "Supplier"("tier", "status");

-- CreateIndex
CREATE INDEX "Supplier_isFeatured_status_idx" ON "Supplier"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "Supplier_slug_idx" ON "Supplier"("slug");

-- AddForeignKey
ALTER TABLE "SupplierCertification" ADD CONSTRAINT "SupplierCertification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFollower" ADD CONSTRAINT "SupplierFollower_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFollower" ADD CONSTRAINT "SupplierFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReview" ADD CONSTRAINT "SupplierReview_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReview" ADD CONSTRAINT "SupplierReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierVerificationLog" ADD CONSTRAINT "SupplierVerificationLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
