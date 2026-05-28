-- CreateTable
CREATE TABLE "WhatsAppSettings" (
    "id"             TEXT NOT NULL DEFAULT 'singleton',
    "phone"          TEXT NOT NULL DEFAULT '',
    "defaultMessage" TEXT NOT NULL DEFAULT '',
    "isEnabled"      BOOLEAN NOT NULL DEFAULT false,
    "showFloating"   BOOLEAN NOT NULL DEFAULT true,
    "showOnProduct"  BOOLEAN NOT NULL DEFAULT true,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id")
);
