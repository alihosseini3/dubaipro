-- Filter system upgrade: rating / discount / new-arrivals / search
-- Adds new toggles + labels on FilterSettings and matching per-category
-- override columns on CategoryFilterConfig.
--
-- NOTE: FilterSettings and CategoryFilterConfig were originally created
-- via `db push` without a migration file. We guard with IF NOT EXISTS
-- so this file replays cleanly on a fresh shadow database AND is a
-- no-op on the production database that already has these tables.

-- ── Ensure FilterSettings base table exists ──────────────────────────
CREATE TABLE IF NOT EXISTS "FilterSettings" (
  "id"                  TEXT        NOT NULL DEFAULT 'singleton',
  "showPriceFilter"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "showBrandFilter"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "showSupplierFilter"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "showInStockFilter"   BOOLEAN     NOT NULL DEFAULT TRUE,
  "showB2BFilter"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "maxBrandsVisible"    INTEGER     NOT NULL DEFAULT 8,
  "maxSuppliersVisible" INTEGER     NOT NULL DEFAULT 8,
  "priceSliderStep"     INTEGER     NOT NULL DEFAULT 10,
  "priceLabel"          TEXT        NOT NULL DEFAULT 'Price Range',
  "brandLabel"          TEXT        NOT NULL DEFAULT 'Brand',
  "supplierLabel"       TEXT        NOT NULL DEFAULT 'Supplier',
  "availabilityLabel"   TEXT        NOT NULL DEFAULT 'Availability',
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FilterSettings_pkey" PRIMARY KEY ("id")
);

-- ── Ensure CategoryFilterConfig base table exists ─────────────────────
CREATE TABLE IF NOT EXISTS "CategoryFilterConfig" (
  "categoryId"       TEXT NOT NULL,
  "showPriceFilter"  BOOLEAN,
  "showBrandFilter"  BOOLEAN,
  "showSupplierFilter" BOOLEAN,
  "showInStockFilter" BOOLEAN,
  "showB2BFilter"    BOOLEAN,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoryFilterConfig_pkey" PRIMARY KEY ("categoryId")
);

DO $$ BEGIN
  ALTER TABLE "CategoryFilterConfig"
    ADD CONSTRAINT "CategoryFilterConfig_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── FilterSettings: new visibility flags + labels ─────────────────────
ALTER TABLE "FilterSettings"
  ADD COLUMN IF NOT EXISTS "showRatingFilter"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "showDiscountFilter"    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "showNewArrivalsFilter" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "showSearchFilter"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "ratingLabel"           TEXT NOT NULL DEFAULT 'Rating',
  ADD COLUMN IF NOT EXISTS "discountLabel"         TEXT NOT NULL DEFAULT 'Deals',
  ADD COLUMN IF NOT EXISTS "newArrivalsLabel"      TEXT NOT NULL DEFAULT 'New Arrivals',
  ADD COLUMN IF NOT EXISTS "searchLabel"           TEXT NOT NULL DEFAULT 'Search products';

-- ── CategoryFilterConfig: nullable overrides (NULL = inherit global) ──
ALTER TABLE "CategoryFilterConfig"
  ADD COLUMN IF NOT EXISTS "showRatingFilter"      BOOLEAN,
  ADD COLUMN IF NOT EXISTS "showDiscountFilter"    BOOLEAN,
  ADD COLUMN IF NOT EXISTS "showNewArrivalsFilter" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "showSearchFilter"      BOOLEAN;
