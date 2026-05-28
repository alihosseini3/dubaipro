-- ============================================================================
-- Backfill: schema drift from db-push operations
-- 1. Drop column defaults that shadow DB has but actual DB doesn't
-- 2. Create tables that were added via db push (AttributeDefinition etc.)
-- All statements are idempotent and safe to re-run.
-- ============================================================================

-- ── 1. Fix column defaults ───────────────────────────────────────────────────
-- The original migration files set DB-level defaults that Prisma manages at
-- the application layer. The actual DB (set up via db push) has no defaults.
ALTER TABLE "MediaAsset"          ALTER COLUMN "tags"      DROP DEFAULT;
ALTER TABLE "FilterSettings"      ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CategoryFilterConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ── 2. AttributeDefinition ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AttributeDefinition" (
  "id"               TEXT         NOT NULL,
  "name"             TEXT         NOT NULL,
  "slug"             TEXT         NOT NULL,
  "type"             VARCHAR(16)  NOT NULL DEFAULT 'select',
  "unit"             VARCHAR(16),
  "options"          JSONB,
  "sortOrder"        INTEGER      NOT NULL DEFAULT 0,
  "nameTranslations" JSONB,
  "group"            VARCHAR(64),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttributeDefinition_slug_key"
  ON "AttributeDefinition"("slug");
CREATE INDEX IF NOT EXISTS "AttributeDefinition_slug_idx"
  ON "AttributeDefinition"("slug");

-- ── 3. CategoryAttribute ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CategoryAttribute" (
  "id"           TEXT    NOT NULL,
  "categoryId"   TEXT    NOT NULL,
  "attributeId"  TEXT    NOT NULL,
  "isFilterable" BOOLEAN NOT NULL DEFAULT TRUE,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAttribute_categoryId_attributeId_key"
  ON "CategoryAttribute"("categoryId", "attributeId");
CREATE INDEX IF NOT EXISTS "CategoryAttribute_categoryId_idx"
  ON "CategoryAttribute"("categoryId");

DO $$ BEGIN
  ALTER TABLE "CategoryAttribute"
    ADD CONSTRAINT "CategoryAttribute_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CategoryAttribute"
    ADD CONSTRAINT "CategoryAttribute_attributeId_fkey"
    FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. ProductAttributeValue ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProductAttributeValue" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "value"       TEXT NOT NULL,
  CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAttributeValue_productId_attributeId_key"
  ON "ProductAttributeValue"("productId", "attributeId");
CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_idx"
  ON "ProductAttributeValue"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey"
    FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
