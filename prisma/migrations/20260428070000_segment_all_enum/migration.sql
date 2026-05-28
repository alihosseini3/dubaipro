-- Adding the new enum value MUST happen in its own migration so it is
-- committed before the next migration references it as a default.
-- Postgres rejects ALTER TYPE ADD VALUE + use-of-value in the same tx.
ALTER TYPE "CustomerSegment" ADD VALUE IF NOT EXISTS 'ALL' BEFORE 'NEW';
