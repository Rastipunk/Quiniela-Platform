// Smoke-test the production Quote PDF renderer with an in-memory
// row. Writes ./_test-quote-render.pdf. Not part of CI — run by hand
// to confirm asset + font loading works after a build change.
//
//   npx tsx scripts/_test-quote-render.ts

import fs from "node:fs";
import path from "node:path";
import type { Quote } from "@prisma/client";
import { renderQuotePdf } from "../src/pdf/renderQuotePdf";

const mock: Quote = {
  id: "test",
  consecutive: "COT-2026-0001",
  year: 2026,
  number: 1,
  clientLegalName: "Linalca Informática SAS BIC",
  clientContactEmail: "jbuitrago@linalca.com",
  issuerSnapshotJson: {} as never,
  locale: "es",
  term: "polla",
  participants: 200,
  currency: "COP",
  amountCop: 257_000,
  amountUsdCents: null,
  perPersonAmount: 1_285,
  tournament: "FIFA World Cup 2026",
  investmentDescription: null,
  issueDate: new Date("2026-05-22"),
  validUntil: new Date("2026-06-06"),
  includeCoverPage: true,
  notes: null,
  status: "ACTIVE" as never,
  createdByUserId: "test",
  createdAtUtc: new Date(),
  updatedAtUtc: new Date(),
};

async function main() {
  const buf = await renderQuotePdf(mock);
  const out = path.resolve("./_test-quote-render.pdf");
  fs.writeFileSync(out, buf);
  console.log(`✓ Wrote ${out} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
