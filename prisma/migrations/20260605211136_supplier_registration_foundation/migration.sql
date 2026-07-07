/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BUYER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('MANUFACTURER', 'TRADING_COMPANY', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'SERVICE_PROVIDER');

-- CreateEnum
CREATE TYPE "SupplierOnboardingStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplierDocumentType" AS ENUM ('TRADE_LICENSE', 'PASSPORT', 'STORE_PHOTO', 'WAREHOUSE_PHOTO');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "address" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "companyType" "CompanyType",
ADD COLUMN     "emirate" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "onboardingStatus" "SupplierOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "primaryCategoryId" TEXT,
ADD COLUMN     "tradeLicenseNumber" TEXT,
ADD COLUMN     "tradeName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'BUYER',
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "SupplierCategory" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierDocumentType" NOT NULL,
    "fileUrl" VARCHAR(2048) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierVerification" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "SupplierOnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierCategory_categoryId_idx" ON "SupplierCategory"("categoryId");

-- CreateIndex
CREATE INDEX "SupplierCategory_supplierId_idx" ON "SupplierCategory"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategory_supplierId_categoryId_key" ON "SupplierCategory"("supplierId", "categoryId");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierId_idx" ON "SupplierDocument"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierId_type_idx" ON "SupplierDocument"("supplierId", "type");

-- CreateIndex
CREATE INDEX "SupplierVerification_supplierId_idx" ON "SupplierVerification"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierVerification_status_idx" ON "SupplierVerification"("status");

-- CreateIndex
CREATE INDEX "Supplier_onboardingStatus_idx" ON "Supplier"("onboardingStatus");

-- CreateIndex
CREATE INDEX "Supplier_primaryCategoryId_idx" ON "Supplier"("primaryCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierVerification" ADD CONSTRAINT "SupplierVerification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
