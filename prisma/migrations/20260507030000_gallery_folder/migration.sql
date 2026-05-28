-- CreateTable
CREATE TABLE "GalleryFolder" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GalleryFolder_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "GalleryFolder_name_key" ON "GalleryFolder"("name");

-- CreateIndex
CREATE INDEX "GalleryFolder_name_idx" ON "GalleryFolder"("name");
