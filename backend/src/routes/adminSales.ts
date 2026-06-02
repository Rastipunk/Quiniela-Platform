/**
 * Sales Management routes (admin-only).
 *
 * Mounted under /admin/sales/* in routes/admin.ts. Every endpoint
 * gated by requireAuth + requireAdmin (composed via router.use).
 *
 * Spec: SALES_AUDIT.md §9.6, SALES_IMPLEMENTATION.md commit 5.
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  sendOk, sendData, sendCreated, sendBadRequest,
  sendNotFound, sendConflict, sendInternal, sendForbidden, sendUnauthorized,
} from "../lib/apiResponse";
import { ServiceError } from "../services/authService";
import {
  issueQuote,
  getQuote,
  listQuotes,
  cancelQuote,
  type SaleCurrency,
} from "../services/sales/quoteService";
import {
  issueAccountReceivable,
  getAccountReceivable,
  listAccountReceivables,
  cancelAccountReceivable,
  markAccountReceivablePaid,
  applyPaidAccountReceivableToPool,
  searchPoolsForCcApply,
} from "../services/sales/accountReceivableService";
import { isTermValidForLocale, SALE_TERMS, type SaleLocale } from "../lib/saleTerms";
import { renderQuotePdf } from "../pdf/renderQuotePdf";
import { renderCcPdf } from "../pdf/renderCcPdf";

export const adminSalesRouter = Router();

// All sales-admin endpoints require an ADMIN user. Both middlewares
// run on every request — requireAuth first to populate req.auth,
// then requireAdmin to confirm the platformRole.
adminSalesRouter.use(requireAuth, requireAdmin);

// ─── Helpers ─────────────────────────────────────────────────

function handleServiceError(res: any, err: unknown): void {
  if (err instanceof ServiceError) {
    const map: Record<number, (r: any, code: string, extra?: Record<string, unknown>) => void> = {
      400: sendBadRequest,
      401: sendUnauthorized,
      403: sendForbidden,
      404: sendNotFound,
      409: sendConflict,
    };
    const send = map[err.statusHint] ?? sendInternal;
    send(res, err.code, err.extra as Record<string, unknown> | undefined);
    return;
  }
  console.error("[adminSales] Unexpected error:", err);
  sendInternal(res, "INTERNAL_ERROR");
}

// apiResponse helpers expect Record<string, unknown>; our service
// results are typed interfaces. Cast at the edge — the runtime shape
// is the same JSON either way.
function asRecord<T>(v: T): Record<string, unknown> {
  return v as unknown as Record<string, unknown>;
}

// ─── Zod schemas ─────────────────────────────────────────────

const LocaleEnum = z.enum(["es", "en", "pt"]);
const CurrencyEnum = z.enum(["COP", "USD"]);

// `term` is validated against the locale's allowed list at the
// refinement step below — a flat enum here would let "polla" through
// for a `locale: "en"` document.
const allTerms = Array.from(new Set(Object.values(SALE_TERMS).flatMap((t) => [...t])));
const TermEnum = z.enum(allTerms as [string, ...string[]]);

const issueQuoteSchema = z.object({
  clientLegalName: z.string().min(1).max(200),
  clientContactEmail: z.string().email(),
  issueDate: z.string().date(),
  validUntil: z.string().date(),
  locale: LocaleEnum,
  term: TermEnum,
  participants: z.number().int().positive(),
  currency: CurrencyEnum,
  tournament: z.string().max(200).optional(),
  investmentDescription: z.string().max(2000).optional(),
  includeCoverPage: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
}).refine((d) => isTermValidForLocale(d.locale, d.term), {
  message: "Term not allowed for the chosen locale",
  path: ["term"],
});

const issueCcSchema = z.object({
  clientLegalName: z.string().min(1).max(200),
  clientNit: z.string().max(50).optional(),
  clientContactEmail: z.string().email(),
  clientCity: z.string().max(100).optional(),
  issueDate: z.string().date(),
  validUntil: z.string().date(),
  locale: LocaleEnum,
  term: TermEnum,
  concept: z.string().min(1).max(1000),
  tournament: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  targetCapacity: z.number().int().positive(),
  currency: CurrencyEnum,
  poolType: z.literal("corporate").optional(),
  linkedQuoteId: z.string().uuid().optional(),
}).refine((d) => isTermValidForLocale(d.locale, d.term), {
  message: "Term not allowed for the chosen locale",
  path: ["term"],
});

const listFiltersSchema = z.object({
  clientEmail: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const quoteStatusUpdateSchema = z.object({
  status: z.enum(["CANCELLED"]),
});

const ccStatusUpdateSchema = z.object({
  status: z.enum(["CANCELLED", "PAID"]),
});

// ─── /admin/sales/quotes ────────────────────────────────────

adminSalesRouter.post("/quotes", async (req, res) => {
  const parsed = issueQuoteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const result = await issueQuote({
      ...parsed.data,
      locale: parsed.data.locale as SaleLocale,
      currency: parsed.data.currency as SaleCurrency,
      createdByUserId: req.auth!.userId,
    });
    return sendCreated(res, asRecord(result));
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/quotes", async (req, res) => {
  const parsed = listFiltersSchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    // Filter `status` only if it matches the enum. Anything else is ignored
    // (defensive against query-string typos).
    const status = parsed.data.status as "ACTIVE" | "EXPIRED" | "CANCELLED" | undefined;
    const result = await listQuotes({
      clientEmail: parsed.data.clientEmail,
      status,
      fromDate: parsed.data.fromDate,
      toDate: parsed.data.toDate,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return sendData(res, asRecord(result));
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/quotes/:id", async (req, res) => {
  try {
    const quote = await getQuote(req.params.id);
    return sendData(res, { quote });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/quotes/:id/pdf", async (req, res) => {
  try {
    const quote = await getQuote(req.params.id);
    const buf = await renderQuotePdf(quote);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${quote.consecutive}.pdf"`);
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.patch("/quotes/:id/status", async (req, res) => {
  const parsed = quoteStatusUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    // v1 only supports CANCELLED transitions.
    const updated = await cancelQuote(req.params.id);
    return sendOk(res, { id: updated.id, status: updated.status });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// ─── /admin/sales/account-receivables ───────────────────────

adminSalesRouter.post("/account-receivables", async (req, res) => {
  const parsed = issueCcSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const result = await issueAccountReceivable({
      ...parsed.data,
      locale: parsed.data.locale as SaleLocale,
      currency: parsed.data.currency as SaleCurrency,
      createdByUserId: req.auth!.userId,
    });
    return sendCreated(res, asRecord(result));
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/account-receivables", async (req, res) => {
  const parsed = listFiltersSchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const status = parsed.data.status as
      | "PENDING" | "REDEEMED" | "PAID" | "EXPIRED" | "CANCELLED" | undefined;
    const result = await listAccountReceivables({
      clientEmail: parsed.data.clientEmail,
      status,
      fromDate: parsed.data.fromDate,
      toDate: parsed.data.toDate,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    return sendData(res, asRecord(result));
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/account-receivables/:id", async (req, res) => {
  try {
    const cc = await getAccountReceivable(req.params.id);
    return sendData(res, { accountReceivable: cc });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.get("/account-receivables/:id/pdf", async (req, res) => {
  try {
    const cc = await getAccountReceivable(req.params.id);
    const buf = await renderCcPdf(cc);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cc.consecutive}.pdf"`);
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

adminSalesRouter.patch("/account-receivables/:id/status", async (req, res) => {
  const parsed = ccStatusUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const updated = parsed.data.status === "CANCELLED"
      ? await cancelAccountReceivable(req.params.id)
      : await markAccountReceivablePaid(req.params.id);
    return sendOk(res, { id: updated.id, status: updated.status });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// Pool picker for the "apply CC to a pool" flow. ?q matches pool name or
// an active host's email. Min 2 chars (the service returns [] otherwise).
adminSalesRouter.get("/pools/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  try {
    const results = await searchPoolsForCcApply(q);
    return sendData(res, { pools: results });
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// Register a bank-transfer payment and apply the CC's capacity to a
// pool (leg B). One-button: marks PAID if needed, creates the COMPLETED
// PoolPayment, expands the pool, and locks the CC against re-apply.
// Body: { poolId }.
const applyCcSchema = z.object({ poolId: z.string().uuid() });

adminSalesRouter.post("/account-receivables/:id/apply", async (req, res) => {
  const parsed = applyCcSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendBadRequest(res, "VALIDATION_ERROR", { details: parsed.error.flatten() });
  }
  try {
    const result = await applyPaidAccountReceivableToPool({
      ccId: req.params.id,
      poolId: parsed.data.poolId,
      adminUserId: req.auth!.userId,
    });
    // Commit 3 wires the confirmation email here.
    return sendOk(res, asRecord(result));
  } catch (err) {
    return handleServiceError(res, err);
  }
});
