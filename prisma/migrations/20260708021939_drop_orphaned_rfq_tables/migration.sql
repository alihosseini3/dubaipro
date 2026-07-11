-- Drop orphaned RFQ tables/enums: the RFQ feature was removed from the codebase
-- (commit 7f35b19) but its DB objects were never dropped, leaving schema drift.
-- Full data archive: backups/rfq-archive-2026-07-07.json (scripts/archive-rfq-tables.mjs).

-- Remove rows that still reference the enum values dropped below, otherwise the
-- AlterEnum casts fail.
DELETE FROM "AutomationLog" WHERE "eventType"::text LIKE 'RFQ%';
DELETE FROM "AutomationRule" WHERE "eventType"::text LIKE 'RFQ%';
DELETE FROM "HomepageSection" WHERE "type"::text = 'RFQ';

-- AlterEnum
BEGIN;
CREATE TYPE "AutomationEventType_new" AS ENUM ('USER_REGISTERED', 'CART_ABANDONED', 'ORDER_CREATED', 'PAYMENT_SUCCESS', 'FIRST_PURCHASE_UPSELL', 'POST_PURCHASE_REMINDER', 'INACTIVE_COMEBACK', 'AFFILIATE_INVITE', 'ORDER_FOLLOWUP', 'DISCOUNT_OFFER');
ALTER TABLE "AutomationRule" ALTER COLUMN "eventType" TYPE "AutomationEventType_new" USING ("eventType"::text::"AutomationEventType_new");
ALTER TABLE "AutomationLog" ALTER COLUMN "eventType" TYPE "AutomationEventType_new" USING ("eventType"::text::"AutomationEventType_new");
ALTER TYPE "AutomationEventType" RENAME TO "AutomationEventType_old";
ALTER TYPE "AutomationEventType_new" RENAME TO "AutomationEventType";
DROP TYPE "public"."AutomationEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "HomepageSectionType_new" AS ENUM ('HERO', 'CATEGORIES', 'FEATURED_PRODUCTS', 'TRUST', 'BECOME_SUPPLIER', 'GLOBAL_SHOPPING', 'TOP_SUPPLIERS', 'AUCTION', 'BLOG');
ALTER TABLE "HomepageSection" ALTER COLUMN "type" TYPE "HomepageSectionType_new" USING ("type"::text::"HomepageSectionType_new");
ALTER TYPE "HomepageSectionType" RENAME TO "HomepageSectionType_old";
ALTER TYPE "HomepageSectionType_new" RENAME TO "HomepageSectionType";
DROP TYPE "public"."HomepageSectionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "RFQ" DROP CONSTRAINT "RFQ_productId_fkey";

-- DropForeignKey
ALTER TABLE "RFQ" DROP CONSTRAINT "RFQ_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "RFQ" DROP CONSTRAINT "RFQ_userId_fkey";

-- DropForeignKey
ALTER TABLE "RfqAttachment" DROP CONSTRAINT "RfqAttachment_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqAuditLog" DROP CONSTRAINT "RfqAuditLog_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqEventOutbox" DROP CONSTRAINT "RfqEventOutbox_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqMessage" DROP CONSTRAINT "RfqMessage_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "RfqMessage" DROP CONSTRAINT "RfqMessage_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqMessage" DROP CONSTRAINT "RfqMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "RfqQuote" DROP CONSTRAINT "RfqQuote_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqQuote" DROP CONSTRAINT "RfqQuote_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "RfqRequest" DROP CONSTRAINT "RfqRequest_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "RfqRequest" DROP CONSTRAINT "RfqRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "RfqSupplierInvite" DROP CONSTRAINT "RfqSupplierInvite_rfqId_fkey";

-- DropForeignKey
ALTER TABLE "RfqSupplierInvite" DROP CONSTRAINT "RfqSupplierInvite_supplierId_fkey";

-- DropTable
DROP TABLE "RFQ";

-- DropTable
DROP TABLE "RfqAttachment";

-- DropTable
DROP TABLE "RfqAuditLog";

-- DropTable
DROP TABLE "RfqEventOutbox";

-- DropTable
DROP TABLE "RfqMessage";

-- DropTable
DROP TABLE "RfqQuote";

-- DropTable
DROP TABLE "RfqRequest";

-- DropTable
DROP TABLE "RfqSupplierInvite";

-- DropEnum
DROP TYPE "OutboxStatus";

-- DropEnum
DROP TYPE "RfqQuoteStatus";

-- DropEnum
DROP TYPE "RfqRequestStatus";

-- DropEnum
DROP TYPE "RfqStatus";

-- DropEnum
DROP TYPE "RfqUrgency";

-- DropEnum
DROP TYPE "RfqVisibility";
