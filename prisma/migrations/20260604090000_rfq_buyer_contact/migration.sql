-- Add buyer contact fields to RfqRequest so suppliers can reach the buyer.
ALTER TABLE "RfqRequest" ADD COLUMN "contactWhatsapp" VARCHAR(32);
ALTER TABLE "RfqRequest" ADD COLUMN "contactEmail" VARCHAR(255);
