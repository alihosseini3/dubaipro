-- AlterTable
ALTER TABLE "MediaSettings" ADD COLUMN     "aiAutoGenerate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiUseWebSearch" BOOLEAN NOT NULL DEFAULT false;
