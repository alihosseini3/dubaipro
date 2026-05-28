-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'MANUAL_REVIEW';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" VARCHAR(32),
ADD COLUMN     "paymentStatus" "PaymentStatus" DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "method" VARCHAR(32),
ADD COLUMN     "receiptImage" TEXT,
ADD COLUMN     "referenceNumber" VARCHAR(128);

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");
