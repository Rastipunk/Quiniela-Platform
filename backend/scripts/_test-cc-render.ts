// Smoke-test the production CC PDF renderer. Outputs two variants
// (COP + USD) so we verify the Bancolombia conditional.
//
//   npx tsx scripts/_test-cc-render.ts

import fs from "node:fs";
import path from "node:path";
import type { AccountReceivable } from "@prisma/client";
import { renderCcPdf } from "../src/pdf/renderCcPdf";
import { snapshotIssuer } from "../src/lib/issuerInfo";

function makeMock(overrides: Partial<AccountReceivable>): AccountReceivable {
  const base: AccountReceivable = {
    id: "test",
    consecutive: "CC-2026-0001",
    year: 2026,
    number: 1,
    redemptionCode: "81245190",
    clientLegalName: "Linalca Informática SAS BIC",
    clientNit: "900.123.456-7",
    clientContactEmail: "jbuitrago@linalca.com",
    clientCity: "Bogotá D.C.",
    issuerSnapshotJson: snapshotIssuer() as never,
    locale: "es",
    term: "polla",
    concept: "Plan Empresarial Picks4All — 200 cupos para la pool corporativa de Linalca Informática SAS BIC. Torneo: FIFA World Cup 2026.",
    tournament: "FIFA World Cup 2026",
    notes: null,
    currency: "COP",
    amountCop: 257_000,
    amountUsdCents: null,
    amountInWords: "DOSCIENTOS CINCUENTA Y SIETE MIL PESOS M/CTE",
    targetCapacity: 200,
    poolType: "corporate",
    issueDate: new Date("2026-05-22"),
    validUntil: new Date("2026-06-06"),
    status: "PENDING" as never,
    redeemedAtUtc: null,
    redeemedByUserId: null,
    paidAtUtc: null,
    linkedQuoteId: null,
    poolPaymentId: null,
    createdByUserId: "test",
    createdAtUtc: new Date(),
    updatedAtUtc: new Date(),
  };
  return { ...base, ...overrides };
}

async function main() {
  // COP variant
  const cop = await renderCcPdf(makeMock({}));
  fs.writeFileSync(path.resolve("./_test-cc-cop.pdf"), cop);
  console.log(`✓ _test-cc-cop.pdf (${cop.length} bytes)`);

  // USD variant — Acme Corp, no Bancolombia
  const usd = await renderCcPdf(makeMock({
    consecutive: "CC-2026-0002",
    redemptionCode: "39417826",
    clientLegalName: "Acme Corporation Inc.",
    clientNit: null,
    clientContactEmail: "ceo@acme.com",
    clientCity: "New York, NY, USA",
    locale: "en",
    term: "pool",
    concept: "Picks4All Enterprise Plan — 200 slots for Acme's corporate pool. Tournament: FIFA World Cup 2026.",
    currency: "USD",
    amountCop: null,
    amountUsdCents: 15_000,
    amountInWords: "ONE HUNDRED FIFTY DOLLARS",
  }));
  fs.writeFileSync(path.resolve("./_test-cc-usd.pdf"), usd);
  console.log(`✓ _test-cc-usd.pdf (${usd.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
