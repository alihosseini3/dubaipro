-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enableMellat" BOOLEAN NOT NULL DEFAULT false,
    "enableZarinpal" BOOLEAN NOT NULL DEFAULT false,
    "enableCardTransfer" BOOLEAN NOT NULL DEFAULT false,
    "enableBankTransfer" BOOLEAN NOT NULL DEFAULT false,
    "enableStripe" BOOLEAN NOT NULL DEFAULT false,
    "enableTap" BOOLEAN NOT NULL DEFAULT false,
    "enablePaypal" BOOLEAN NOT NULL DEFAULT false,
    "mellatTerminalId" VARCHAR(64),
    "mellatUsername" VARCHAR(128),
    "mellatPassword" VARCHAR(256),
    "zarinpalMerchantId" VARCHAR(128),
    "stripePublicKey" VARCHAR(256),
    "stripeSecretKey" VARCHAR(256),
    "stripeWebhookSecret" VARCHAR(256),
    "tapSecretKey" VARCHAR(256),
    "paypalClientId" VARCHAR(256),
    "paypalClientSecret" VARCHAR(256),
    "cardNumber" VARCHAR(64),
    "iban" VARCHAR(64),
    "accountHolder" VARCHAR(128),
    "bankName" VARCHAR(128),
    "manualNotes" VARCHAR(512),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "PaymentSettings" ("id", "updatedAt") VALUES ('default', NOW())
ON CONFLICT ("id") DO NOTHING;
