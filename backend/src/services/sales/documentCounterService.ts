/**
 * Atomic consecutive number generator for sales documents.
 *
 * One row per (kind, year) in DocumentCounter. `nextConsecutive`
 * INSERTs the row if it doesn't exist + increments + returns the new
 * value, all in a single Postgres UPSERT to avoid race conditions
 * between two concurrent issuance attempts on the same kind+year.
 *
 * The caller wraps `nextConsecutive` and the document INSERT in a
 * single `prisma.$transaction` so that a failed INSERT doesn't waste
 * a number — the UPSERT rolls back with the rest of the transaction.
 *
 * Format: `{prefix}-{year}-{number padded to 4 digits}`
 *   QUOTE              → "COT-2026-0001"
 *   ACCOUNT_RECEIVABLE → "CC-2026-0001"
 *
 * See SALES_AUDIT.md §9.3 and SALES_IMPLEMENTATION.md commit 2.
 */

import type { Prisma } from "@prisma/client";

export type CounterKind = "QUOTE" | "ACCOUNT_RECEIVABLE";

const PREFIX: Record<CounterKind, string> = {
  QUOTE: "COT",
  ACCOUNT_RECEIVABLE: "CC",
};

const PADDING = 4; // "0001"

export interface NextConsecutiveResult {
  number: number;
  consecutive: string;
  year: number;
}

/**
 * Reserve the next consecutive for a given kind + year. MUST be called
 * inside a transaction (tx is the Prisma transactional client) so a
 * failure downstream rolls back the counter increment.
 *
 * Returns { number, consecutive, year } where consecutive is the
 * formatted "COT-2026-0001" / "CC-2026-0001" string. Persist both the
 * year and the number on the document row so back-fills and queries
 * can compare without parsing the string.
 */
export async function nextConsecutive(
  tx: Prisma.TransactionClient,
  kind: CounterKind,
  year: number,
): Promise<NextConsecutiveResult> {
  // Atomic UPSERT + RETURNING. Postgres serialises concurrent writers
  // against the (kind, year) primary key, so two parallel calls land
  // sequential numbers with no application-level locking.
  const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
    INSERT INTO "DocumentCounter" ("kind", "year", "lastNumber", "updatedAtUtc")
    VALUES (${kind}::"DocumentKind", ${year}, 1, NOW())
    ON CONFLICT ("kind", "year")
    DO UPDATE SET "lastNumber" = "DocumentCounter"."lastNumber" + 1, "updatedAtUtc" = NOW()
    RETURNING "lastNumber"
  `;

  if (rows.length === 0 || typeof rows[0]?.lastNumber !== "number") {
    throw new Error(`DocumentCounter UPSERT returned no rows for kind=${kind}, year=${year}`);
  }

  const number = rows[0]!.lastNumber;
  const padded = String(number).padStart(PADDING, "0");
  const consecutive = `${PREFIX[kind]}-${year}-${padded}`;

  return { number, consecutive, year };
}
