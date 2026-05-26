/**
 * AccountReceivable (cuenta de cobro) service.
 *
 * Issue + retrieve + redeem + transition lifecycle. The redeem helper
 * (`tryLockAccountReceivable`) is the atomic primitive that
 * paymentService.initiateCheckout calls in commit 6 to flip PENDING →
 * REDEEMED under contention.
 *
 * Spec: SALES_AUDIT.md §6, §9.2, §9.7, §11.*.
 */

import crypto from "node:crypto";
import type { AccountReceivable, AccountReceivableStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { ServiceError } from "../authService";
import {
  calculateUpgradePrice,
  calculateUpgradePriceCop,
  usdToCents,
  CORPORATE_FREE_LIMIT,
} from "../../lib/pricing";
import { snapshotIssuer } from "../../lib/issuerInfo";
import { isTermValidForLocale, type SaleLocale } from "../../lib/saleTerms";
import { amountInWords } from "../../lib/amountInWords";
import { nextConsecutive } from "./documentCounterService";
import type { SaleCurrency } from "./quoteService";

// 8-digit numeric redemption code. Per §11.3 / §11.8 dummy-approved.
const CODE_MIN = 10_000_000;
const CODE_MAX_EXCLUSIVE = 100_000_000;
const CODE_MAX_RETRIES = 5;

export interface IssueAccountReceivableInput {
  // Client
  clientLegalName: string;
  clientNit?: string;
  clientContactEmail: string;
  clientCity?: string;

  // Dates (ISO yyyy-mm-dd)
  issueDate: string;
  validUntil: string;

  // Localization
  locale: SaleLocale;
  term: string;

  // Content
  concept: string;
  tournament?: string;
  notes?: string;

  // Pricing source
  targetCapacity: number;
  currency: SaleCurrency;

  // Locked v1
  poolType?: "corporate";

  // Optional cross-reference
  linkedQuoteId?: string;

  // Audit
  createdByUserId: string;
}

export interface IssueAccountReceivableResult {
  id: string;
  consecutive: string;
  redemptionCode: string;
  amountCop: number | null;
  amountUsdCents: number | null;
  amountInWords: string;
}

function derivePricing(
  targetCapacity: number,
  currency: SaleCurrency,
): { amountCop: number | null; amountUsdCents: number | null } {
  if (targetCapacity <= CORPORATE_FREE_LIMIT) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: `targetCapacity (${targetCapacity}) is within the free tier; CC must charge.`,
    });
  }

  if (currency === "COP") {
    const amountCop = calculateUpgradePriceCop("corporate", CORPORATE_FREE_LIMIT, targetCapacity);
    if (amountCop <= 0) {
      throw new ServiceError("VALIDATION_ERROR", 400, { message: "pricing.ts returned non-positive COP amount" });
    }
    return { amountCop, amountUsdCents: null };
  }

  const amountUsdDecimal = calculateUpgradePrice("corporate", CORPORATE_FREE_LIMIT, targetCapacity);
  if (amountUsdDecimal <= 0) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "pricing.ts returned non-positive USD amount" });
  }
  return { amountCop: null, amountUsdCents: usdToCents(amountUsdDecimal) };
}

/**
 * Generate a unique 8-digit numeric redemption code inside the
 * transaction. Retries on collision (extremely rare at this entropy).
 */
async function generateRedemptionCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < CODE_MAX_RETRIES; attempt++) {
    const raw = String(crypto.randomInt(CODE_MIN, CODE_MAX_EXCLUSIVE));
    const collision = await tx.accountReceivable.findUnique({
      where: { redemptionCode: raw },
      select: { id: true },
    });
    if (!collision) return raw;
  }
  throw new Error("Failed to generate unique redemption code after retries");
}

export async function issueAccountReceivable(
  input: IssueAccountReceivableInput,
): Promise<IssueAccountReceivableResult> {
  if (!isTermValidForLocale(input.locale, input.term)) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: `Term "${input.term}" not allowed for locale "${input.locale}"`,
    });
  }

  // Verify linkedQuoteId exists if provided.
  if (input.linkedQuoteId) {
    const linkedExists = await prisma.quote.findUnique({
      where: { id: input.linkedQuoteId },
      select: { id: true },
    });
    if (!linkedExists) {
      throw new ServiceError("VALIDATION_ERROR", 400, { message: "linkedQuoteId not found" });
    }
  }

  const pricing = derivePricing(input.targetCapacity, input.currency);
  const issuerSnapshotJson = snapshotIssuer() as unknown as Prisma.InputJsonValue;
  const year = new Date(input.issueDate).getUTCFullYear();

  // Amount-in-words: for COP we always have amountCop; for USD we
  // pass the dollar amount (amountUsdCents / 100). Cents > 0 are
  // rounded down — issuing fractional dollars on a CC is unusual,
  // pricing.ts produces whole-dollar amounts almost always.
  const wordsAmount = input.currency === "COP"
    ? pricing.amountCop!
    : Math.floor(pricing.amountUsdCents! / 100);
  const words = amountInWords({
    amount: wordsAmount,
    currency: input.currency,
    locale: input.locale,
  });

  const cc = await prisma.$transaction(async (tx) => {
    const { number, consecutive } = await nextConsecutive(tx, "ACCOUNT_RECEIVABLE", year);
    const redemptionCode = await generateRedemptionCode(tx);

    return tx.accountReceivable.create({
      data: {
        consecutive,
        year,
        number,
        redemptionCode,
        clientLegalName: input.clientLegalName,
        clientNit: input.clientNit ?? null,
        clientContactEmail: input.clientContactEmail.toLowerCase().trim(),
        clientCity: input.clientCity ?? null,
        issuerSnapshotJson,
        locale: input.locale,
        term: input.term,
        concept: input.concept,
        tournament: input.tournament ?? null,
        notes: input.notes ?? null,
        currency: input.currency,
        amountCop: pricing.amountCop,
        amountUsdCents: pricing.amountUsdCents,
        amountInWords: words,
        targetCapacity: input.targetCapacity,
        poolType: input.poolType ?? "corporate",
        issueDate: new Date(input.issueDate),
        validUntil: new Date(input.validUntil),
        linkedQuoteId: input.linkedQuoteId ?? null,
        createdByUserId: input.createdByUserId,
      },
    });
  });

  return {
    id: cc.id,
    consecutive: cc.consecutive,
    redemptionCode: cc.redemptionCode,
    amountCop: cc.amountCop,
    amountUsdCents: cc.amountUsdCents,
    amountInWords: cc.amountInWords,
  };
}

export async function getAccountReceivable(id: string): Promise<AccountReceivable> {
  const cc = await prisma.accountReceivable.findUnique({ where: { id } });
  if (!cc) throw new ServiceError("NOT_FOUND", 404);
  return cc;
}

/**
 * Lookup by redemption code. Accepts the raw 8-digit form or the
 * formatted "XXXX-XXXX" form (UI presentation). Returns null when not
 * found (caller decides how to respond — 404 from a route, polite
 * "Cuenta de cobro no encontrada" from the redemption box).
 */
export async function findByRedemptionCode(code: string): Promise<AccountReceivable | null> {
  const normalised = code.replace(/[^0-9]/g, "");
  if (normalised.length !== 8) return null;
  return prisma.accountReceivable.findUnique({ where: { redemptionCode: normalised } });
}

export interface ListAccountReceivablesFilters {
  clientEmail?: string;
  status?: AccountReceivableStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ListAccountReceivablesResult {
  items: AccountReceivable[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listAccountReceivables(
  filters: ListAccountReceivablesFilters = {},
): Promise<ListAccountReceivablesResult> {
  const page = Math.max(0, filters.page ?? 0);
  const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);

  const where: Prisma.AccountReceivableWhereInput = {};
  if (filters.clientEmail) {
    where.clientContactEmail = { contains: filters.clientEmail.toLowerCase().trim() };
  }
  if (filters.status) where.status = filters.status;
  if (filters.fromDate || filters.toDate) {
    where.createdAtUtc = {};
    if (filters.fromDate) where.createdAtUtc.gte = new Date(filters.fromDate);
    if (filters.toDate) where.createdAtUtc.lte = new Date(filters.toDate);
  }

  const [total, items] = await Promise.all([
    prisma.accountReceivable.count({ where }),
    prisma.accountReceivable.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip: page * limit,
      take: limit,
    }),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function cancelAccountReceivable(id: string): Promise<AccountReceivable> {
  const cc = await prisma.accountReceivable.findUnique({ where: { id } });
  if (!cc) throw new ServiceError("NOT_FOUND", 404);
  if (cc.status === "CANCELLED") return cc;
  return prisma.accountReceivable.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

/**
 * Mark a CC as paid manually. For when the client pays outside the
 * platform (wire transfer) and the admin reconciles by hand.
 * Atomicity: only PENDING / REDEEMED → PAID is allowed; CANCELLED /
 * EXPIRED rows reject to avoid undoing those states.
 */
export async function markAccountReceivablePaid(id: string): Promise<AccountReceivable> {
  const result = await prisma.accountReceivable.updateMany({
    where: { id, status: { in: ["PENDING", "REDEEMED"] } },
    data: { status: "PAID", paidAtUtc: new Date() },
  });
  if (result.count === 0) {
    throw new ServiceError("CONFLICT", 409, {
      message: "Account receivable is not in a state that can transition to PAID",
    });
  }
  const cc = await prisma.accountReceivable.findUnique({ where: { id } });
  if (!cc) throw new ServiceError("NOT_FOUND", 404);
  return cc;
}

/**
 * Atomic PENDING → REDEEMED transition.
 *
 * Called by paymentService.initiateCheckout (commit 6) inside the
 * same transaction that INSERTs the PoolPayment. If two redeemers
 * race on the same code, exactly one wins — the other sees count=0
 * and throws CONFLICT.
 *
 * Mirrors the activate-corporate pattern (ADR-048).
 */
export async function tryLockAccountReceivable(
  tx: Prisma.TransactionClient,
  ccId: string,
  redeemedByUserId: string,
): Promise<{ locked: true } | { locked: false; reason: "ALREADY_REDEEMED" }> {
  const result = await tx.accountReceivable.updateMany({
    where: { id: ccId, status: "PENDING" },
    data: {
      status: "REDEEMED",
      redeemedByUserId,
      redeemedAtUtc: new Date(),
    },
  });
  if (result.count === 0) return { locked: false, reason: "ALREADY_REDEEMED" };
  return { locked: true };
}

/**
 * Inverse of `tryLockAccountReceivable` — used by the reconciler
 * (commit 8) when the linked PoolPayment expires before completion.
 * Only flips REDEEMED → PENDING. PAID rows stay PAID.
 */
export async function releaseAccountReceivable(
  tx: Prisma.TransactionClient,
  ccId: string,
): Promise<void> {
  await tx.accountReceivable.updateMany({
    where: { id: ccId, status: "REDEEMED" },
    data: {
      status: "PENDING",
      redeemedByUserId: null,
      redeemedAtUtc: null,
      poolPaymentId: null,
    },
  });
}
