-- Quote staleness: flag quotes invalidated by a material RFQ change.
ALTER TABLE "RfqQuote" ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RfqQuote" ADD COLUMN "staleAt" TIMESTAMP(3);
ALTER TABLE "RfqQuote" ADD COLUMN "staleReason" VARCHAR(300);
