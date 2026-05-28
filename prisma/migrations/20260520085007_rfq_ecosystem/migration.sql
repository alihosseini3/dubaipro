-- CreateEnum
CREATE TYPE "RfqRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'NEGOTIATING', 'QUOTED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RfqVisibility" AS ENUM ('PUBLIC', 'INVITED_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RfqQuoteStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RfqUrgency" AS ENUM ('STANDARD', 'URGENT', 'ASAP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AutomationEventType" ADD VALUE 'RFQ_REQUEST_CREATED';
ALTER TYPE "AutomationEventType" ADD VALUE 'RFQ_QUOTE_RECEIVED';
ALTER TYPE "AutomationEventType" ADD VALUE 'RFQ_QUOTE_ACCEPTED';
ALTER TYPE "AutomationEventType" ADD VALUE 'RFQ_EXPIRING';
ALTER TYPE "AutomationEventType" ADD VALUE 'RFQ_SUPPLIER_INVITED';

-- CreateTable
CREATE TABLE "RfqRequest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "productRef" VARCHAR(500),
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(32) NOT NULL DEFAULT 'pcs',
    "targetPrice" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "shippingCountry" VARCHAR(2) NOT NULL,
    "urgency" "RfqUrgency" NOT NULL DEFAULT 'STANDARD',
    "visibility" "RfqVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "RfqRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "sourcingNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqAttachment" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128),
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplierInvite" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "RfqSupplierInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqQuote" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "moq" INTEGER,
    "leadTimeDays" INTEGER,
    "shippingTerms" VARCHAR(100),
    "paymentTerms" VARCHAR(100),
    "validUntil" TIMESTAMP(3),
    "message" TEXT,
    "attachmentUrl" VARCHAR(2048),
    "status" "RfqQuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqMessage" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "quoteId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" VARCHAR(2048),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RfqRequest_slug_key" ON "RfqRequest"("slug");

-- CreateIndex
CREATE INDEX "RfqRequest_userId_createdAt_idx" ON "RfqRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqRequest_status_visibility_idx" ON "RfqRequest"("status", "visibility");

-- CreateIndex
CREATE INDEX "RfqRequest_categoryId_idx" ON "RfqRequest"("categoryId");

-- CreateIndex
CREATE INDEX "RfqRequest_slug_idx" ON "RfqRequest"("slug");

-- CreateIndex
CREATE INDEX "RfqRequest_expiresAt_idx" ON "RfqRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "RfqRequest_urgency_status_idx" ON "RfqRequest"("urgency", "status");

-- CreateIndex
CREATE INDEX "RfqAttachment_rfqId_idx" ON "RfqAttachment"("rfqId");

-- CreateIndex
CREATE INDEX "RfqSupplierInvite_supplierId_invitedAt_idx" ON "RfqSupplierInvite"("supplierId", "invitedAt");

-- CreateIndex
CREATE INDEX "RfqSupplierInvite_rfqId_idx" ON "RfqSupplierInvite"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqSupplierInvite_rfqId_supplierId_key" ON "RfqSupplierInvite"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "RfqQuote_rfqId_status_idx" ON "RfqQuote"("rfqId", "status");

-- CreateIndex
CREATE INDEX "RfqQuote_supplierId_createdAt_idx" ON "RfqQuote"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqQuote_status_idx" ON "RfqQuote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RfqQuote_rfqId_supplierId_key" ON "RfqQuote"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "RfqMessage_rfqId_createdAt_idx" ON "RfqMessage"("rfqId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqMessage_quoteId_createdAt_idx" ON "RfqMessage"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqMessage_senderId_idx" ON "RfqMessage"("senderId");

-- CreateIndex
CREATE INDEX "RfqMessage_isRead_idx" ON "RfqMessage"("isRead");

-- AddForeignKey
ALTER TABLE "RfqRequest" ADD CONSTRAINT "RfqRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqRequest" ADD CONSTRAINT "RfqRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAttachment" ADD CONSTRAINT "RfqAttachment_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplierInvite" ADD CONSTRAINT "RfqSupplierInvite_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplierInvite" ADD CONSTRAINT "RfqSupplierInvite_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuote" ADD CONSTRAINT "RfqQuote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuote" ADD CONSTRAINT "RfqQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqMessage" ADD CONSTRAINT "RfqMessage_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqMessage" ADD CONSTRAINT "RfqMessage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RfqQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqMessage" ADD CONSTRAINT "RfqMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
