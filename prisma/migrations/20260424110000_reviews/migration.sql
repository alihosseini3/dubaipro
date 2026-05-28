-- CreateTable
CREATE TABLE "Review" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating"    INTEGER NOT NULL,
    "comment"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_userId_productId_key"
  ON "Review"("userId", "productId");
CREATE INDEX "Review_productId_createdAt_idx"
  ON "Review"("productId", "createdAt");
CREATE INDEX "Review_userId_idx" ON "Review"("userId");
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
