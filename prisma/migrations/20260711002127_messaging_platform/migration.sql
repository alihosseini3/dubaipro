-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'INQUIRY', 'SAMPLE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SampleRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'SHIPPED', 'CLOSED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastMessagePreview" VARCHAR(200),
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "subject" VARCHAR(200),
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "sellerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "type" VARCHAR(20) NOT NULL DEFAULT 'TEXT';

-- Full-text search: generated column over Message.content + GIN index.
-- Hand-written (Prisma cannot express GENERATED columns); the schema mirrors
-- it as `searchVector Unsupported("tsvector")?`.
ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;
CREATE INDEX "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberRole" VARCHAR(20) NOT NULL DEFAULT 'PARTICIPANT',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "url" VARCHAR(2048) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "shippingInfo" JSONB,
    "status" "SampleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationMember_userId_isArchived_unreadCount_idx" ON "ConversationMember"("userId", "isArchived", "unreadCount");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "SampleRequest_supplierId_status_createdAt_idx" ON "SampleRequest"("supplierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SampleRequest_buyerId_createdAt_idx" ON "SampleRequest"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "SampleRequest_productId_idx" ON "SampleRequest"("productId");

-- CreateIndex
CREATE INDEX "Conversation_supplierId_lastMessageAt_idx" ON "Conversation"("supplierId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_productId_idx" ON "Conversation"("productId");

-- CreateIndex
CREATE INDEX "Conversation_type_lastMessageAt_idx" ON "Conversation"("type", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequest" ADD CONSTRAINT "SampleRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
