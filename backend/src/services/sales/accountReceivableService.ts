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

// ─── Apply a transfer-paid CC to a pool (admin) ──────────────
//
// The "(B) bank transfer" leg of CC payment: the client wired the
// money, the admin reconciles by hand and applies the paid capacity to
// the pool the client indicated. This is the missing bridge between
// "PAID" and "capacity applied" — the card leg (A) does it inside
// initiateCheckout + markPaymentCompleted, but markAccountReceivablePaid
// only flipped the status. See SALES_CC_APPLY_PLAN.md + ADR-067.
//
// Idempotent & single-apply: `poolPaymentId != null` is the lock — a CC
// can only ever be applied to one pool. No re-pricing (the CC amount the
// client paid is the source of truth, per the owner's decision).

export interface ApplyPaidCcInput {
  ccId: string;
  poolId: string;
  adminUserId: string;
}

export interface ApplyPaidCcResult {
  ccId: string;
  consecutive: string;
  poolId: string;
  poolPaymentId: string;
  fromCapacity: number;
  toCapacity: number;
  // Fields the route uses to send the confirmation receipt email.
  clientContactEmail: string;
  clientLegalName: string;
  poolName: string;
  hostUserId: string;
  locale: string;
  currency: string;
  amountCop: number | null;
  amountUsdCents: number | null;
}

export async function applyPaidAccountReceivableToPool(
  input: ApplyPaidCcInput,
): Promise<ApplyPaidCcResult> {
  const cc = await prisma.accountReceivable.findUnique({ where: { id: input.ccId } });
  if (!cc) throw new ServiceError("NOT_FOUND", 404, { message: "Account receivable not found" });

  // Single-apply lock: once linked to a PoolPayment it can never reapply.
  if (cc.poolPaymentId) {
    throw new ServiceError("ALREADY_APPLIED", 409, {
      message: "This account receivable was already applied to a pool",
      poolPaymentId: cc.poolPaymentId,
    });
  }
  if (cc.status === "CANCELLED" || cc.status === "EXPIRED") {
    throw new ServiceError("CONFLICT", 409, {
      message: `Account receivable status ${cc.status} cannot be applied`,
    });
  }
  // REDEEMED means it is mid-card-checkout (leg A); the automatic flow
  // owns it — don't double-apply by hand.
  if (cc.status === "REDEEMED") {
    throw new ServiceError("CONFLICT", 409, {
      message: "Account receivable is in card checkout (REDEEMED); it will apply automatically",
    });
  }

  const pool = await prisma.pool.findUnique({
    where: { id: input.poolId },
    select: {
      id: true,
      name: true,
      maxParticipants: true,
      organizationId: true,
      members: {
        where: { role: { in: ["CORPORATE_HOST", "HOST"] }, status: "ACTIVE" },
        select: { userId: true, role: true },
      },
    },
  });
  if (!pool) throw new ServiceError("NOT_FOUND", 404, { message: "Pool not found" });

  const fromCapacity = pool.maxParticipants ?? CORPORATE_FREE_LIMIT;
  if (cc.targetCapacity <= fromCapacity) {
    throw new ServiceError("CONFLICT", 409, {
      message: `Nothing to apply: pool capacity (${fromCapacity}) is already >= CC targetCapacity (${cc.targetCapacity})`,
    });
  }

  // Prefer the CORPORATE_HOST, fall back to a HOST. The PoolPayment is
  // attributed to whoever owns the pool (may differ from the CC contact
  // — cross-account case).
  const host =
    pool.members.find((m) => m.role === "CORPORATE_HOST")?.userId ??
    pool.members.find((m) => m.role === "HOST")?.userId;
  if (!host) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: "Pool has no active HOST/CORPORATE_HOST to attribute the payment to",
    });
  }

  // PoolPayment.amountUsd is USD cents (required). For a COP CC we keep
  // the COP the client paid and derive the USD-cents equivalent from the
  // pricing library; for a USD CC we use the CC's own cents.
  const amountCop = cc.amountCop;
  const amountUsdCents =
    cc.currency === "USD"
      ? cc.amountUsdCents ?? 0
      : usdToCents(calculateUpgradePrice("corporate", fromCapacity, cc.targetCapacity));

  const payment = await prisma.$transaction(async (tx) => {
    // 1. Mark PAID if it wasn't already (one-button "register payment + apply").
    if (cc.status !== "PAID") {
      await tx.accountReceivable.update({
        where: { id: cc.id },
        data: { status: "PAID", paidAtUtc: cc.paidAtUtc ?? new Date() },
      });
    }

    // 2. PoolPayment COMPLETED — the contable trace of the applied capacity.
    const created = await tx.poolPayment.create({
      data: {
        poolId: input.poolId,
        userId: host,
        polarCheckoutId: null,
        polarOrderId: `manual-cc-${cc.consecutive}`,
        status: "COMPLETED",
        amountUsd: amountUsdCents,
        amountCop,
        currency: cc.currency.toLowerCase(),
        fromCapacity,
        toCapacity: cc.targetCapacity,
        poolType: "corporate",
        accountReceivableId: cc.id,
        paidAtUtc: cc.paidAtUtc ?? new Date(),
      },
    });

    // 3. Expand the pool + re-arm capacity notifications.
    await tx.pool.update({
      where: { id: input.poolId },
      data: {
        maxParticipants: cc.targetCapacity,
        poolFullNotifiedAt: null,
        capacityWarningNotifiedAt: null,
      },
    });

    // 4. Link the CC to the payment — the single-apply lock.
    await tx.accountReceivable.update({
      where: { id: cc.id },
      data: {
        poolPaymentId: created.id,
        redeemedAtUtc: new Date(),
        redeemedByUserId: input.adminUserId,
      },
    });

    // 5. Audit trail.
    await tx.auditEvent.create({
      data: {
        actorUserId: input.adminUserId,
        action: "PAYMENT_COMPLETED",
        entityType: "Pool",
        entityId: input.poolId,
        poolId: input.poolId,
        dataJson: {
          appliedManually: true,
          method: "bank_transfer",
          cc: cc.consecutive,
          fromCapacity,
          toCapacity: cc.targetCapacity,
          amountCop,
          amountUsdCents,
          paymentId: created.id,
        } as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  return {
    ccId: cc.id,
    consecutive: cc.consecutive,
    poolId: input.poolId,
    poolPaymentId: payment.id,
    fromCapacity,
    toCapacity: cc.targetCapacity,
    clientContactEmail: cc.clientContactEmail,
    clientLegalName: cc.clientLegalName,
    poolName: pool.name,
    hostUserId: host,
    locale: cc.locale,
    currency: cc.currency,
    amountCop,
    amountUsdCents,
  };
}

// ─── Pool search for the CC-apply admin UI ───────────────────
//
// Powers the "apply to a pool" picker: matches by pool name OR by the
// email of an active HOST/CORPORATE_HOST. Capped to keep the picker
// snappy. Read-only.

export interface PoolSearchResult {
  id: string;
  name: string;
  status: string;
  maxParticipants: number | null;
  organizationId: string | null;
  hostEmail: string | null;
}

const POOL_SEARCH_LIMIT = 20;

export async function searchPoolsForCcApply(q: string): Promise<PoolSearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const pools = await prisma.pool.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        {
          members: {
            some: {
              role: { in: ["CORPORATE_HOST", "HOST"] },
              status: "ACTIVE",
              user: { email: { contains: term, mode: "insensitive" } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      maxParticipants: true,
      organizationId: true,
      members: {
        where: { role: { in: ["CORPORATE_HOST", "HOST"] }, status: "ACTIVE" },
        select: { role: true, user: { select: { email: true } } },
      },
    },
    orderBy: { createdAtUtc: "desc" },
    take: POOL_SEARCH_LIMIT,
  });

  return pools.map((p) => {
    const host =
      p.members.find((m) => m.role === "CORPORATE_HOST") ?? p.members.find((m) => m.role === "HOST");
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      maxParticipants: p.maxParticipants,
      organizationId: p.organizationId,
      hostEmail: host?.user.email ?? null,
    };
  });
}
