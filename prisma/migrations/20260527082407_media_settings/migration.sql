-- CreateTable
CREATE TABLE "MediaSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiProvider" VARCHAR(20),
    "aiApiKey" VARCHAR(500),
    "aiModel" VARCHAR(100),
    "aiBaseUrl" VARCHAR(500),
    "aiTimeoutMs" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "MediaSettings_pkey" PRIMARY KEY ("id")
);
