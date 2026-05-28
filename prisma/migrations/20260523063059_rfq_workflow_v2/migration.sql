-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RfqRequestStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "RfqRequestStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "RfqRequestStatus" ADD VALUE 'FULFILLED';

-- AlterTable
ALTER TABLE "RfqRequest" ADD COLUMN     "extensionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RfqAuditLog" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "fromStatus" "RfqRequestStatus",
    "toStatus" "RfqRequestStatus" NOT NULL,
    "actorId" VARCHAR(36) NOT NULL,
    "actorRole" VARCHAR(20) NOT NULL,
    "trigger" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqEventOutbox" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "RfqEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfqAuditLog_rfqId_createdAt_idx" ON "RfqAuditLog"("rfqId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqAuditLog_createdAt_idx" ON "RfqAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "RfqEventOutbox_status_createdAt_idx" ON "RfqEventOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RfqEventOutbox_rfqId_idx" ON "RfqEventOutbox"("rfqId");

-- AddForeignKey
ALTER TABLE "RfqAuditLog" ADD CONSTRAINT "RfqAuditLog_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqEventOutbox" ADD CONSTRAINT "RfqEventOutbox_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RfqRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
