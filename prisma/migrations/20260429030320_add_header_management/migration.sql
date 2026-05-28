-- DropIndex
DROP INDEX "AutomationRule_eventType_channel_locale_key";

-- CreateTable
CREATE TABLE "HeaderSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "logoUrl" TEXT,
    "logoText" TEXT NOT NULL DEFAULT 'DubaiPro',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "topbarText" TEXT NOT NULL DEFAULT 'Shipping from Dubai',
    "showTopBar" BOOLEAN NOT NULL DEFAULT true,
    "showSearch" BOOLEAN NOT NULL DEFAULT true,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Request quote',
    "ctaHref" TEXT NOT NULL DEFAULT '/contact?type=quote',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeaderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavigationItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MegaMenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MegaMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NavigationItem_isActive_order_idx" ON "NavigationItem"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MegaMenuItem_categoryId_key" ON "MegaMenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MegaMenuItem_isActive_order_idx" ON "MegaMenuItem"("isActive", "order");

-- AddForeignKey
ALTER TABLE "MegaMenuItem" ADD CONSTRAINT "MegaMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CouponUsage_couponId_userId" RENAME TO "CouponUsage_couponId_userId_idx";
