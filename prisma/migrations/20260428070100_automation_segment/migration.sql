-- Per-segment automation templates.
-- Existing rows backfill to ALL so the new unique key is satisfied.
ALTER TABLE "AutomationRule"
  ADD COLUMN IF NOT EXISTS "segment" "CustomerSegment" NOT NULL DEFAULT 'ALL';

-- Replace the 3-tuple unique with the new 4-tuple including segment.
ALTER TABLE "AutomationRule"
  DROP CONSTRAINT IF EXISTS "AutomationRule_eventType_channel_locale_key";

ALTER TABLE "AutomationRule"
  ADD CONSTRAINT "AutomationRule_eventType_channel_locale_segment_key"
  UNIQUE ("eventType","channel","locale","segment");
