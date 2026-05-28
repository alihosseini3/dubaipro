-- Add compareAtPrice for price psychology (strikethrough + save %)
ALTER TABLE "Product"
  ADD COLUMN "compareAtPrice" DECIMAL(12,2);
