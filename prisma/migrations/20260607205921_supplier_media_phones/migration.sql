-- AlterEnum
ALTER TYPE "SupplierDocumentType" ADD VALUE 'STORE_VIDEO';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "phones" TEXT[] DEFAULT ARRAY[]::TEXT[];
