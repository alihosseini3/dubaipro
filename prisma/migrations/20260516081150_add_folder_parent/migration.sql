-- AlterTable
ALTER TABLE "GalleryFolder" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "GalleryFolder_parentId_idx" ON "GalleryFolder"("parentId");

-- AddForeignKey
ALTER TABLE "GalleryFolder" ADD CONSTRAINT "GalleryFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GalleryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
