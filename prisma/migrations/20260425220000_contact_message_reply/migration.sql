-- Migration: Add reply fields to ContactMessage and relations to Conversation/User
-- PostgreSQL syntax

-- Add reply columns to ContactMessage
ALTER TABLE "ContactMessage" 
ADD COLUMN IF NOT EXISTS "replyContent" TEXT,
ADD COLUMN IF NOT EXISTS "replySentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "repliedById" TEXT,
ADD COLUMN IF NOT EXISTS "conversationId" TEXT;

-- Add foreign key constraint for conversation
ALTER TABLE "ContactMessage" 
ADD CONSTRAINT "ContactMessage_conversationId_fkey" 
FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraint for repliedBy (admin user)
ALTER TABLE "ContactMessage" 
ADD CONSTRAINT "ContactMessage_repliedById_fkey" 
FOREIGN KEY ("repliedById") REFERENCES "User"(id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add new index for conversationId
CREATE INDEX IF NOT EXISTS "ContactMessage_conversationId_idx" ON "ContactMessage"("conversationId");
