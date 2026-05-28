-- CreateTable
CREATE TABLE "Wishlist" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wishlist_userId_key" ON "Wishlist"("userId");

ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id"         TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productId"  TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WishlistItem_wishlistId_productId_key"
  ON "WishlistItem"("wishlistId", "productId");
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");
CREATE INDEX "WishlistItem_wishlistId_createdAt_idx"
  ON "WishlistItem"("wishlistId", "createdAt");

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey"
  FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
