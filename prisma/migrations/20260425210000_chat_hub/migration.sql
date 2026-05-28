-- Extend WhatsAppSettings with chat-hub toggles
ALTER TABLE "WhatsAppSettings"
  ADD COLUMN "enableInternalChat" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "enableContactForm"  BOOLEAN NOT NULL DEFAULT true;

-- Status enum for guest contact submissions
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- Contact messages submitted from the public Chat Hub by guests
CREATE TABLE "ContactMessage" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "subject"   TEXT,
  "message"   TEXT NOT NULL,
  "userId"    TEXT,
  "locale"    TEXT,
  "userAgent" TEXT,
  "status"    "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX "ContactMessage_status_idx"    ON "ContactMessage"("status");
CREATE INDEX "ContactMessage_email_idx"     ON "ContactMessage"("email");
