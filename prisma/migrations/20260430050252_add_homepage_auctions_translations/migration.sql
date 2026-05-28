-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "sourceHash" VARCHAR(64) NOT NULL,
    "sourceLocale" VARCHAR(8) NOT NULL,
    "targetLocale" VARCHAR(8) NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_targetLocale_idx" ON "Translation"("targetLocale");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_sourceHash_targetLocale_key" ON "Translation"("sourceHash", "targetLocale");
