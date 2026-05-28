-- Professional category system: hierarchy, icon, image, SEO, status, ordering
ALTER TABLE "Category"
  ADD COLUMN "parentId"        TEXT,
  ADD COLUMN "icon"            VARCHAR(64),
  ADD COLUMN "imageUrl"        TEXT,
  ADD COLUMN "description"     VARCHAR(500),
  ADD COLUMN "metaTitle"       VARCHAR(70),
  ADD COLUMN "metaDescription" VARCHAR(200),
  ADD COLUMN "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isActive"        BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "Category_isActive_idx"  ON "Category"("isActive");
