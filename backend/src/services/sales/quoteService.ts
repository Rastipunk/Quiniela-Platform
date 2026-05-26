/**
 * Quote (cotización) service.
 *
 * Owns issue + retrieve + list + cancel for Quote rows. Pricing is
 * always derived from lib/pricing.ts — admin never supplies the
 * amount (per §11.20). Issuer values are snapshotted at issue time
 * for legal audit (per §8).
 *
 * Spec: SALES_AUDIT.md §5.3, §9.1, §11.*.
 */

import type { Prisma, Quote, QuoteStatus } from "@prisma/client";
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
import { nextConsecutive } from "./documentCounterService";

export type SaleCurrency = "COP" | "USD";

export interface IssueQuoteInput {
  // Client
  clientLegalName: string;
  clientContactEmail: string;

  // Dates (ISO yyyy-mm-dd)
  issueDate: string;
  validUntil: string;

  // Localization
  locale: SaleLocale;
  term: string;

  // Investment
  participants: number;
  currency: SaleCurrency;
  tournament?: string;
  investmentDescription?: string;

  // Layout
  includeCoverPage?: boolean;
  notes?: string;

  // Audit
  createdByUserId: string;
}

export interface IssueQuoteResult {
  id: string;
  consecutive: string;
  amountCop: number | null;
  amountUsdCents: number | null;
  perPersonAmount: number;
}

/**
 * Server-derive the amount + per-person value for a corporate quote.
 * Throws if pricing.ts says the participants count is free-tier
 * (admin shouldn't be quoting a $0 invoice; if they want to give it
 * away, they don't need a quote).
 */
function derivePricing(
  participants: number,
  currency: SaleCurrency,
): { amountCop: number | null; amountUsdCents: number | null; perPersonAmount: number } {
  if (participants <= CORPORATE_FREE_LIMIT) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: `Participants (${participants}) is within the free tier (${CORPORATE_FREE_LIMIT}). Nothing to charge.`,
    });
  }

  if (currency === "COP") {
    const amountCop = calculateUpgradePriceCop("corporate", CORPORATE_FREE_LIMIT, participants);
    if (amountCop <= 0) {
      throw new ServiceError("VALIDATION_ERROR", 400, { message: "pricing.ts returned non-positive COP amount" });
    }
    return {
      amountCop,
      amountUsdCents: null,
      perPersonAmount: Math.round(amountCop / participants),
    };
  }

  // USD path — pricing.ts returns dollars as decimals; convert to cents.
  const amountUsdDecimal = calculateUpgradePrice("corporate", CORPORATE_FREE_LIMIT, participants);
  if (amountUsdDecimal <= 0) {
    throw new ServiceError("VALIDATION_ERROR", 400, { message: "pricing.ts returned non-positive USD amount" });
  }
  const amountUsdCents = usdToCents(amountUsdDecimal);
  return {
    amountCop: null,
    amountUsdCents,
    perPersonAmount: Math.round(amountUsdCents / participants),
  };
}

export async function issueQuote(input: IssueQuoteInput): Promise<IssueQuoteResult> {
  if (!isTermValidForLocale(input.locale, input.term)) {
    throw new ServiceError("VALIDATION_ERROR", 400, {
      message: `Term "${input.term}" not allowed for locale "${input.locale}"`,
    });
  }

  const pricing = derivePricing(input.participants, input.currency);
  const issuerSnapshotJson = snapshotIssuer() as unknown as Prisma.InputJsonValue;
  const year = new Date(input.issueDate).getUTCFullYear();

  // Counter increment + INSERT live in the same transaction so a
  // failed INSERT doesn't waste a consecutive number.
  const quote = await prisma.$transaction(async (tx) => {
    const { number, consecutive } = await nextConsecutive(tx, "QUOTE", year);

    return tx.quote.create({
      data: {
        consecutive,
        year,
        number,
        clientLegalName: input.clientLegalName,
        clientContactEmail: input.clientContactEmail.toLowerCase().trim(),
        issuerSnapshotJson,
        locale: input.locale,
        term: input.term,
        participants: input.participants,
        currency: input.currency,
        amountCop: pricing.amountCop,
        amountUsdCents: pricing.amountUsdCents,
        perPersonAmount: pricing.perPersonAmount,
        tournament: input.tournament ?? null,
        investmentDescription: input.investmentDescription ?? null,
        issueDate: new Date(input.issueDate),
        validUntil: new Date(input.validUntil),
        includeCoverPage: input.includeCoverPage ?? true,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId,
      },
    });
  });

  return {
    id: quote.id,
    consecutive: quote.consecutive,
    amountCop: quote.amountCop,
    amountUsdCents: quote.amountUsdCents,
    perPersonAmount: quote.perPersonAmount,
  };
}

export async function getQuote(id: string): Promise<Quote> {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw new ServiceError("NOT_FOUND", 404);
  return quote;
}

export interface ListQuotesFilters {
  clientEmail?: string;
  status?: QuoteStatus;
  fromDate?: string; // ISO yyyy-mm-dd
  toDate?: string;   // ISO yyyy-mm-dd
  page?: number;
  limit?: number;
}

export interface ListQuotesResult {
  quotes: Quote[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listQuotes(filters: ListQuotesFilters = {}): Promise<ListQuotesResult> {
  const page = Math.max(0, filters.page ?? 0);
  const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);

  const where: Prisma.QuoteWhereInput = {};
  if (filters.clientEmail) {
    where.clientContactEmail = { contains: filters.clientEmail.toLowerCase().trim() };
  }
  if (filters.status) where.status = filters.status;
  if (filters.fromDate || filters.toDate) {
    where.createdAtUtc = {};
    if (filters.fromDate) where.createdAtUtc.gte = new Date(filters.fromDate);
    if (filters.toDate) where.createdAtUtc.lte = new Date(filters.toDate);
  }

  const [total, quotes] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      orderBy: { createdAtUtc: "desc" },
      skip: page * limit,
      take: limit,
    }),
  ]);

  return {
    quotes,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function cancelQuote(id: string): Promise<Quote> {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw new ServiceError("NOT_FOUND", 404);
  if (quote.status === "CANCELLED") return quote;
  return prisma.quote.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}
