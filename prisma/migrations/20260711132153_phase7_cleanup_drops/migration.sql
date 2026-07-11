-- DropForeignKey
ALTER TABLE "B2BInquiry" DROP CONSTRAINT "B2BInquiry_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "B2BInquiry" DROP CONSTRAINT "B2BInquiry_productId_fkey";

-- DropForeignKey
ALTER TABLE "B2BInquiryReply" DROP CONSTRAINT "B2BInquiryReply_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_sellerId_fkey";

-- DropIndex
DROP INDEX "Conversation_customerId_sellerId_key";

-- DropIndex
DROP INDEX "Conversation_customerId_updatedAt_idx";

-- DropIndex
DROP INDEX "Conversation_sellerId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "customerId",
DROP COLUMN "sellerId";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "tierPricing";

-- DropTable
DROP TABLE "B2BInquiry";

-- DropTable
DROP TABLE "B2BInquiryReply";
