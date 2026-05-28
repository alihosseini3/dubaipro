-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PageSectionType" ADD VALUE 'PRODUCT_GRID';
ALTER TYPE "PageSectionType" ADD VALUE 'STATS';
ALTER TYPE "PageSectionType" ADD VALUE 'TRUST_SECTION';
ALTER TYPE "PageSectionType" ADD VALUE 'SUPPLIER_SHOWCASE';
ALTER TYPE "PageSectionType" ADD VALUE 'BLOG_POSTS';
ALTER TYPE "PageSectionType" ADD VALUE 'AUCTION_SHOWCASE';
