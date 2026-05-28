-- CreateTable: MediaAsset — central media library for the admin gallery
CREATE TABLE "MediaAsset" (
    "id"           TEXT NOT NULL,
    "filename"     VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "url"          VARCHAR(500) NOT NULL,
    "mimeType"     VARCHAR(64)  NOT NULL,
    "size"         INTEGER      NOT NULL,
    "width"        INTEGER,
    "height"       INTEGER,
    "alt"          VARCHAR(255),
    "title"        VARCHAR(255),
    "caption"      VARCHAR(500),
    "folder"       VARCHAR(64)  NOT NULL DEFAULT 'general',
    "tags"         TEXT[]       NOT NULL DEFAULT '{}',
    "uploadedById" TEXT         NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_folder_idx"       ON "MediaAsset"("folder");
CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");
CREATE INDEX "MediaAsset_createdAt_idx"    ON "MediaAsset"("createdAt");
CREATE INDEX "MediaAsset_mimeType_idx"     ON "MediaAsset"("mimeType");

-- AddForeignKey
ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
