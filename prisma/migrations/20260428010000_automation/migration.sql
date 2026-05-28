-- CreateEnum
CREATE TYPE "AutomationEventType" AS ENUM ('USER_REGISTERED', 'CART_ABANDONED', 'ORDER_CREATED', 'PAYMENT_SUCCESS', 'RFQ_CREATED');

-- CreateEnum
CREATE TYPE "AutomationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "eventType" "AutomationEventType" NOT NULL,
    "channel" "AutomationChannel" NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_eventType_idx" ON "AutomationRule"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_eventType_channel_locale_key" ON "AutomationRule"("eventType", "channel", "locale");

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "AutomationEventType" NOT NULL,
    "channel" "AutomationChannel" NOT NULL,
    "status" "AutomationStatus" NOT NULL,
    "recipient" VARCHAR(255),
    "dedupeKey" VARCHAR(255),
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationLog_userId_createdAt_idx" ON "AutomationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_eventType_createdAt_idx" ON "AutomationLog"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationLog_dedupeKey_channel_eventType_key" ON "AutomationLog"("dedupeKey", "channel", "eventType");
