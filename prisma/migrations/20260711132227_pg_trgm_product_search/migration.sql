-- Substring product-title search at scale: pg_trgm GIN index makes
-- `title ILIKE '%term%'` an index scan instead of a sequential scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"
  ON "Product" USING GIN ("title" gin_trgm_ops);

-- Keyset (cursor) pagination support for the busiest feeds.
CREATE INDEX IF NOT EXISTS "Product_createdAt_id_idx"
  ON "Product" ("createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_id_idx"
  ON "AuditLog" ("createdAt" DESC, "id" DESC);
