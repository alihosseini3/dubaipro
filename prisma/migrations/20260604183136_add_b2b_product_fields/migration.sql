/*
  Warnings:

  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "certifications" JSONB,
ADD COLUMN     "customization" JSONB,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "moq" INTEGER DEFAULT 1,
ADD COLUMN     "moqUnit" TEXT DEFAULT 'pieces',
ADD COLUMN     "originCountry" VARCHAR(100),
ADD COLUMN     "sampleMOQ" INTEGER DEFAULT 1,
ADD COLUMN     "samplePrice" DECIMAL(12,2),
ADD COLUMN     "tierPricing" JSONB,
ADD COLUMN     "tradeTerms" VARCHAR(50),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "videoUrls" JSONB,
ADD COLUMN     "warrantyYears" INTEGER;

-- CreateTable
CREATE TABLE "B2BInquiry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2BInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2BInquiryReply" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2BInquiryReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "B2BInquiry_productId_idx" ON "B2BInquiry"("productId");

-- CreateIndex
CREATE INDEX "B2BInquiry_buyerId_idx" ON "B2BInquiry"("buyerId");

-- CreateIndex
CREATE INDEX "B2BInquiry_status_idx" ON "B2BInquiry"("status");

-- CreateIndex
CREATE INDEX "B2BInquiryReply_inquiryId_idx" ON "B2BInquiryReply"("inquiryId");

-- CreateIndex
CREATE INDEX "Product_isPublished_idx" ON "Product"("isPublished");

-- CreateIndex
CREATE INDEX "Product_moq_idx" ON "Product"("moq");

-- AddForeignKey
ALTER TABLE "B2BInquiry" ADD CONSTRAINT "B2BInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BInquiry" ADD CONSTRAINT "B2BInquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BInquiryReply" ADD CONSTRAINT "B2BInquiryReply_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "B2BInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
