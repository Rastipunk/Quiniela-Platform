-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedPrivacyAt" TIMESTAMP(3),
ADD COLUMN     "acceptedPrivacyVersion" TEXT,
ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN     "acceptedTermsVersion" TEXT,
ADD COLUMN     "ageVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changeSummary" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_type_locale_isActive_idx" ON "LegalDocument"("type", "locale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_type_version_locale_key" ON "LegalDocument"("type", "version", "locale");
