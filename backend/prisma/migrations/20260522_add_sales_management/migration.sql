-- Sales Management — initial schema (commit 1 of 14).
--
-- Three new tables back the /admin/ventas/ panel and the cuenta-de-cobro
-- redemption flow. See SALES_AUDIT.md §9 and SALES_IMPLEMENTATION.md
-- commit 1 for the full spec. Locked decisions: §11.1-§11.23.
--
-- Additive-only. No data backfill required, no existing rows touched.
-- The PoolPayment FK column (`accountReceivableId`) is nullable so all
-- existing PoolPayment rows remain valid without the link.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────

CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TYPE "AccountReceivableStatus" AS ENUM ('PENDING', 'REDEEMED', 'PAID', 'EXPIRED', 'CANCELLED');

CREATE TYPE "DocumentKind" AS ENUM ('QUOTE', 'ACCOUNT_RECEIVABLE');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Quote (cotización)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "Quote" (
    "id"                    TEXT NOT NULL,
    "consecutive"           TEXT NOT NULL,
    "year"                  INTEGER NOT NULL,
    "number"                INTEGER NOT NULL,
    "clientLegalName"       TEXT NOT NULL,
    "clientContactEmail"    TEXT NOT NULL,
    "issuerSnapshotJson"    JSONB NOT NULL,
    "locale"                TEXT NOT NULL,
    "term"                  TEXT NOT NULL,
    "participants"          INTEGER NOT NULL,
    "currency"              TEXT NOT NULL,
    "amountCop"             INTEGER,
    "amountUsdCents"        INTEGER,
    "perPersonAmount"       INTEGER NOT NULL,
    "tournament"            TEXT,
    "investmentDescription" TEXT,
    "issueDate"             DATE NOT NULL,
    "validUntil"            DATE NOT NULL,
    "includeCoverPage"      BOOLEAN NOT NULL DEFAULT true,
    "notes"                 TEXT,
    "status"                "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId"       TEXT NOT NULL,
    "createdAtUtc"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quote_consecutive_key" ON "Quote"("consecutive");
CREATE INDEX "Quote_clientContactEmail_idx" ON "Quote"("clientContactEmail");
CREATE INDEX "Quote_createdAtUtc_idx" ON "Quote"("createdAtUtc");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. AccountReceivable (cuenta de cobro)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "AccountReceivable" (
    "id"                   TEXT NOT NULL,
    "consecutive"          TEXT NOT NULL,
    "year"                 INTEGER NOT NULL,
    "number"               INTEGER NOT NULL,
    "redemptionCode"       TEXT NOT NULL,
    "clientLegalName"      TEXT NOT NULL,
    "clientNit"            TEXT,
    "clientContactEmail"   TEXT NOT NULL,
    "clientCity"           TEXT,
    "issuerSnapshotJson"   JSONB NOT NULL,
    "locale"               TEXT NOT NULL,
    "term"                 TEXT NOT NULL,
    "concept"              TEXT NOT NULL,
    "tournament"           TEXT,
    "notes"                TEXT,
    "currency"             TEXT NOT NULL,
    "amountCop"            INTEGER,
    "amountUsdCents"       INTEGER,
    "amountInWords"        TEXT NOT NULL,
    "targetCapacity"       INTEGER NOT NULL,
    "poolType"             TEXT NOT NULL,
    "issueDate"            DATE NOT NULL,
    "validUntil"           DATE NOT NULL,
    "status"               "AccountReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "redeemedAtUtc"        TIMESTAMP(3),
    "redeemedByUserId"     TEXT,
    "paidAtUtc"            TIMESTAMP(3),
    "linkedQuoteId"        TEXT,
    "poolPaymentId"        TEXT,
    "createdByUserId"      TEXT NOT NULL,
    "createdAtUtc"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountReceivable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountReceivable_consecutive_key" ON "AccountReceivable"("consecutive");
CREATE UNIQUE INDEX "AccountReceivable_redemptionCode_key" ON "AccountReceivable"("redemptionCode");
CREATE UNIQUE INDEX "AccountReceivable_poolPaymentId_key" ON "AccountReceivable"("poolPaymentId");
CREATE INDEX "AccountReceivable_clientContactEmail_idx" ON "AccountReceivable"("clientContactEmail");
CREATE INDEX "AccountReceivable_status_validUntil_idx" ON "AccountReceivable"("status", "validUntil");

ALTER TABLE "AccountReceivable"
  ADD CONSTRAINT "AccountReceivable_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountReceivable"
  ADD CONSTRAINT "AccountReceivable_redeemedByUserId_fkey"
  FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountReceivable"
  ADD CONSTRAINT "AccountReceivable_linkedQuoteId_fkey"
  FOREIGN KEY ("linkedQuoteId") REFERENCES "Quote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. DocumentCounter — composite PK (kind, year)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "DocumentCounter" (
    "kind"         "DocumentKind" NOT NULL,
    "year"         INTEGER NOT NULL,
    "lastNumber"   INTEGER NOT NULL DEFAULT 0,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("kind", "year")
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. PoolPayment.accountReceivableId — nullable 1:1 FK
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "PoolPayment" ADD COLUMN "accountReceivableId" TEXT;

CREATE UNIQUE INDEX "PoolPayment_accountReceivableId_key" ON "PoolPayment"("accountReceivableId");

ALTER TABLE "PoolPayment"
  ADD CONSTRAINT "PoolPayment_accountReceivableId_fkey"
  FOREIGN KEY ("accountReceivableId") REFERENCES "AccountReceivable"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
