-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "periodMonths" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(32) NOT NULL,
    "method" VARCHAR(32),
    "providerId" TEXT,
    "referenceNumber" VARCHAR(128),
    "errorMessage" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_providerId_key" ON "SubscriptionInvoice"("providerId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_supplierId_status_idx" ON "SubscriptionInvoice"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_createdAt_idx" ON "SubscriptionInvoice"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
