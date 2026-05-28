-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "exifData" JSONB,
ADD COLUMN     "originalUrl" VARCHAR(2048),
ADD COLUMN     "processingStatus" VARCHAR(20) NOT NULL DEFAULT 'done',
ADD COLUMN     "storageProvider" VARCHAR(20) NOT NULL DEFAULT 'local',
ALTER COLUMN "url" SET DATA TYPE VARCHAR(2048),
ALTER COLUMN "thumbnailUrl" SET DATA TYPE VARCHAR(2048);

-- AlterTable
ALTER TABLE "MediaVariant" ALTER COLUMN "url" SET DATA TYPE VARCHAR(2048);

-- CreateTable
CREATE TABLE "MediaTransformJob" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" VARCHAR(500),
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaTransformJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaTransformJob_status_scheduledAt_idx" ON "MediaTransformJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MediaTransformJob_assetId_idx" ON "MediaTransformJob"("assetId");

-- CreateIndex
CREATE INDEX "MediaAsset_processingStatus_idx" ON "MediaAsset"("processingStatus");

-- CreateIndex
CREATE INDEX "MediaAsset_storageProvider_idx" ON "MediaAsset"("storageProvider");

-- AddForeignKey
ALTER TABLE "MediaTransformJob" ADD CONSTRAINT "MediaTransformJob_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
