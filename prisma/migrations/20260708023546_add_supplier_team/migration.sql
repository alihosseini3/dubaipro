-- CreateEnum
CREATE TYPE "SupplierMemberRole" AS ENUM ('OWNER', 'MANAGER', 'PRODUCT_EDITOR', 'MESSAGING_AGENT', 'ANALYST');

-- CreateTable
CREATE TABLE "SupplierMember" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SupplierMemberRole" NOT NULL DEFAULT 'OWNER',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvite" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SupplierMemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMember_userId_key" ON "SupplierMember"("userId");

-- CreateIndex
CREATE INDEX "SupplierMember_supplierId_isActive_idx" ON "SupplierMember"("supplierId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMember_supplierId_userId_key" ON "SupplierMember"("supplierId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvite_tokenHash_key" ON "SupplierInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SupplierInvite_supplierId_createdAt_idx" ON "SupplierInvite"("supplierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvite_supplierId_email_key" ON "SupplierInvite"("supplierId", "email");

-- AddForeignKey
ALTER TABLE "SupplierMember" ADD CONSTRAINT "SupplierMember_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMember" ADD CONSTRAINT "SupplierMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvite" ADD CONSTRAINT "SupplierInvite_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
