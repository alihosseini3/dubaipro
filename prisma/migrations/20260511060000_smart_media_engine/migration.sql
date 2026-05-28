-- ============================================================================
-- Smart Media Engine — Phase 1
-- Adds responsive variants, multi-format pipeline metadata, SEO fields,
-- duplicate detection (hash), focal point, health score, and a usage
-- cross-reference table to the existing MediaAsset.
--
-- 100% backward compatible: all new columns are nullable / array-default,
-- existing columns are untouched, and no FK constraint is added to the
-- legacy URL columns on Product/Category/Brand/etc.
-- ============================================================================

-- ── 0. Backfill columns that were originally added via `db push` ────────────
-- `thumbnailUrl` was missing from the original MediaAsset migration.
ALTER TABLE "MediaAsset"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" VARCHAR(500);

-- ── 1. Extend MediaAsset ────────────────────────────────────────────────────
ALTER TABLE "MediaAsset"
  ADD COLUMN IF NOT EXISTS "seoTitle"          VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "description"       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "keywords"          TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "dominantColor"     VARCHAR(9),
  ADD COLUMN IF NOT EXISTS "blurDataURL"       TEXT,
  ADD COLUMN IF NOT EXISTS "hash"              VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "focalX"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "focalY"            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "context"           VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "optimizationScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "compressionRatio"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "metadata"          JSONB;

-- Unique hash for duplicate detection (only one row per identical file).
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_hash_key"
  ON "MediaAsset" ("hash")
  WHERE "hash" IS NOT NULL;

-- Secondary lookup indexes.
CREATE INDEX IF NOT EXISTS "MediaAsset_context_idx" ON "MediaAsset" ("context");
CREATE INDEX IF NOT EXISTS "MediaAsset_hash_idx"    ON "MediaAsset" ("hash");

-- ── 2. MediaVariant ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaVariant" (
    "id"        TEXT        NOT NULL,
    "assetId"   TEXT        NOT NULL,
    "preset"    VARCHAR(32) NOT NULL,
    "format"    VARCHAR(8)  NOT NULL,
    "url"       VARCHAR(500) NOT NULL,
    "width"     INTEGER     NOT NULL,
    "height"    INTEGER     NOT NULL,
    "size"      INTEGER     NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaVariant_assetId_preset_format_key"
  ON "MediaVariant" ("assetId", "preset", "format");

CREATE INDEX IF NOT EXISTS "MediaVariant_assetId_idx"
  ON "MediaVariant" ("assetId");

DO $$ BEGIN
  ALTER TABLE "MediaVariant"
    ADD CONSTRAINT "MediaVariant_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "MediaAsset" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. MediaUsage ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaUsage" (
    "id"         TEXT        NOT NULL,
    "assetId"    TEXT        NOT NULL,
    "entityType" VARCHAR(32) NOT NULL,
    "entityId"   VARCHAR(64) NOT NULL,
    "field"      VARCHAR(64) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaUsage_assetId_entityType_entityId_field_key"
  ON "MediaUsage" ("assetId", "entityType", "entityId", "field");

CREATE INDEX IF NOT EXISTS "MediaUsage_entityType_entityId_idx"
  ON "MediaUsage" ("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "MediaUsage_assetId_idx"
  ON "MediaUsage" ("assetId");

DO $$ BEGIN
  ALTER TABLE "MediaUsage"
    ADD CONSTRAINT "MediaUsage_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "MediaAsset" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
