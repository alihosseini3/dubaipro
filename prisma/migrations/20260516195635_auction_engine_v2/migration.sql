-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "reservePrice" DECIMAL(12,2),
ADD COLUMN     "totalBids" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "winnerUserId" TEXT;

-- CreateTable
CREATE TABLE "AuctionWatch" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionImage" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionWatch_auctionId_idx" ON "AuctionWatch"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionWatch_userId_idx" ON "AuctionWatch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionWatch_auctionId_userId_key" ON "AuctionWatch"("auctionId", "userId");

-- CreateIndex
CREATE INDEX "AuctionImage_auctionId_order_idx" ON "AuctionImage"("auctionId", "order");

-- CreateIndex
CREATE INDEX "Auction_winnerUserId_idx" ON "Auction"("winnerUserId");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionWatch" ADD CONSTRAINT "AuctionWatch_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionWatch" ADD CONSTRAINT "AuctionWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionImage" ADD CONSTRAINT "AuctionImage_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
