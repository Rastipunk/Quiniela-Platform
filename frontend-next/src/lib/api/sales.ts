// Sales API — admin issuance + customer redemption.
//
// Wraps the backend's /admin/sales/* and /sales/account-receivables/*
// endpoints. Auth is cookie-based (handled by requestJson); the token
// param is kept on each signature to match the conventions of admin.ts
// and corporate.ts even though requestJson reads the cookie directly.
//
// See SALES_IMPLEMENTATION.md commit 9.

import { API_BASE, requestJson } from "./client";

// ─── Shared enums + types ──────────────────────────────────────────

export type SaleLocale = "es" | "en" | "pt";
export type SaleCurrency = "COP" | "USD";

export type QuoteStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type AccountReceivableStatus =
  | "PENDING"
  | "REDEEMED"
  | "PAID"
  | "EXPIRED"
  | "CANCELLED";

// Issuer snapshot frozen at issuance time (deep copy of
// backend/lib/issuerInfo.ts). Stored as JSON on the row; we accept it
// as `unknown` here since it's rendered by the PDF — UI rarely needs
// to inspect individual fields.
export interface IssuerSnapshot {
  legalName: string;
  documentType: string;
  documentNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  bank?: {
    name: string;
    accountType: string;
    accountNumber: string;
  };
  taxStatusPhrase?: string;
}

// ─── Quote ─────────────────────────────────────────────────────────

export interface QuoteRow {
  id: string;
  consecutive: string;
  year: number;
  number: number;
  clientLegalName: string;
  clientContactEmail: string;
  issuerSnapshotJson: IssuerSnapshot;
  locale: SaleLocale;
  term: string;
  participants: number;
  tournament: string | null;
  investmentDescription: string | null;
  includeCoverPage: boolean;
  notes: string | null;
  currency: SaleCurrency;
  amountCop: number | null;
  amountUsdCents: number | null;
  perPersonAmount: number;
  issueDate: string; // ISO date
  validUntil: string; // ISO date
  status: QuoteStatus;
  createdByUserId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateQuoteInput {
  clientLegalName: string;
  clientContactEmail: string;
  issueDate: string; // yyyy-mm-dd
  validUntil: string; // yyyy-mm-dd
  locale: SaleLocale;
  term: string;
  participants: number;
  currency: SaleCurrency;
  tournament?: string;
  investmentDescription?: string;
  includeCoverPage?: boolean;
  notes?: string;
}

export interface CreateQuoteResponse {
  id: string;
  consecutive: string;
  amountCop: number | null;
  amountUsdCents: number | null;
  perPersonAmount: number;
}

export interface ListQuotesFilters {
  clientEmail?: string;
  status?: QuoteStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ListQuotesResponse {
  quotes: QuoteRow[];
  total: number;
  page: number;
  totalPages: number;
}

export async function createQuote(
  _token: string,
  input: CreateQuoteInput,
): Promise<CreateQuoteResponse> {
  return requestJson<CreateQuoteResponse>("/admin/sales/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listQuotes(
  _token: string,
  filters: ListQuotesFilters = {},
): Promise<ListQuotesResponse> {
  const q = new URLSearchParams();
  if (filters.clientEmail) q.set("clientEmail", filters.clientEmail);
  if (filters.status) q.set("status", filters.status);
  if (filters.fromDate) q.set("fromDate", filters.fromDate);
  if (filters.toDate) q.set("toDate", filters.toDate);
  if (filters.page !== undefined) q.set("page", String(filters.page));
  if (filters.limit !== undefined) q.set("limit", String(filters.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return requestJson<ListQuotesResponse>(`/admin/sales/quotes${qs}`, { method: "GET" });
}

export async function getQuote(_token: string, id: string): Promise<{ quote: QuoteRow }> {
  return requestJson<{ quote: QuoteRow }>(`/admin/sales/quotes/${id}`, { method: "GET" });
}

export async function cancelQuote(
  _token: string,
  id: string,
): Promise<{ ok: true; id: string; status: QuoteStatus }> {
  return requestJson<{ ok: true; id: string; status: QuoteStatus }>(
    `/admin/sales/quotes/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) },
  );
}

// Returns the absolute URL to the PDF. The browser hits it directly
// (cookies travel automatically because the API and the site share
// the picks4all.com parent domain via CORS credentials=include).
// Use in `<a href={url} download>` or `window.open(url)`.
export function quotePdfUrl(id: string): string {
  return `${API_BASE}/admin/sales/quotes/${id}/pdf`;
}

// ─── Account Receivable ───────────────────────────────────────────

export interface AccountReceivableRow {
  id: string;
  consecutive: string;
  year: number;
  number: number;
  redemptionCode: string;
  clientLegalName: string;
  clientNit: string | null;
  clientContactEmail: string;
  clientCity: string | null;
  issuerSnapshotJson: IssuerSnapshot;
  locale: SaleLocale;
  term: string;
  concept: string;
  tournament: string | null;
  notes: string | null;
  currency: SaleCurrency;
  amountCop: number | null;
  amountUsdCents: number | null;
  amountInWords: string;
  targetCapacity: number;
  poolType: string;
  issueDate: string;
  validUntil: string;
  status: AccountReceivableStatus;
  redeemedAtUtc: string | null;
  redeemedByUserId: string | null;
  paidAtUtc: string | null;
  linkedQuoteId: string | null;
  poolPaymentId: string | null;
  createdByUserId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateAccountReceivableInput {
  clientLegalName: string;
  clientNit?: string;
  clientContactEmail: string;
  clientCity?: string;
  issueDate: string;
  validUntil: string;
  locale: SaleLocale;
  term: string;
  concept: string;
  tournament?: string;
  notes?: string;
  targetCapacity: number;
  currency: SaleCurrency;
  poolType?: "corporate";
  linkedQuoteId?: string;
}

export interface CreateAccountReceivableResponse {
  id: string;
  consecutive: string;
  redemptionCode: string;
  amountCop: number | null;
  amountUsdCents: number | null;
  amountInWords: string;
}

export interface ListAccountReceivablesFilters {
  clientEmail?: string;
  status?: AccountReceivableStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ListAccountReceivablesResponse {
  items: AccountReceivableRow[];
  total: number;
  page: number;
  totalPages: number;
}

export async function createAccountReceivable(
  _token: string,
  input: CreateAccountReceivableInput,
): Promise<CreateAccountReceivableResponse> {
  return requestJson<CreateAccountReceivableResponse>("/admin/sales/account-receivables", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listAccountReceivables(
  _token: string,
  filters: ListAccountReceivablesFilters = {},
): Promise<ListAccountReceivablesResponse> {
  const q = new URLSearchParams();
  if (filters.clientEmail) q.set("clientEmail", filters.clientEmail);
  if (filters.status) q.set("status", filters.status);
  if (filters.fromDate) q.set("fromDate", filters.fromDate);
  if (filters.toDate) q.set("toDate", filters.toDate);
  if (filters.page !== undefined) q.set("page", String(filters.page));
  if (filters.limit !== undefined) q.set("limit", String(filters.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return requestJson<ListAccountReceivablesResponse>(
    `/admin/sales/account-receivables${qs}`,
    { method: "GET" },
  );
}

export async function getAccountReceivable(
  _token: string,
  id: string,
): Promise<{ accountReceivable: AccountReceivableRow }> {
  return requestJson<{ accountReceivable: AccountReceivableRow }>(
    `/admin/sales/account-receivables/${id}`,
    { method: "GET" },
  );
}

export async function cancelAccountReceivable(
  _token: string,
  id: string,
): Promise<{ ok: true; id: string; status: AccountReceivableStatus }> {
  return requestJson<{ ok: true; id: string; status: AccountReceivableStatus }>(
    `/admin/sales/account-receivables/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) },
  );
}

export async function markAccountReceivablePaid(
  _token: string,
  id: string,
): Promise<{ ok: true; id: string; status: AccountReceivableStatus }> {
  return requestJson<{ ok: true; id: string; status: AccountReceivableStatus }>(
    `/admin/sales/account-receivables/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ status: "PAID" }) },
  );
}

export function accountReceivablePdfUrl(id: string): string {
  return `${API_BASE}/admin/sales/account-receivables/${id}/pdf`;
}

// ─── CC apply (bank-transfer leg) ───────────────────────────────────

export interface PoolSearchRow {
  id: string;
  name: string;
  status: string;
  maxParticipants: number | null;
  organizationId: string | null;
  hostEmail: string | null;
}

// Pool picker for the "apply CC to a pool" modal. Matches pool name or
// an active host's email; backend returns [] for q shorter than 2.
export async function searchPoolsForApply(
  _token: string,
  q: string,
): Promise<{ pools: PoolSearchRow[] }> {
  return requestJson<{ pools: PoolSearchRow[] }>(
    `/admin/sales/pools/search?q=${encodeURIComponent(q)}`,
    { method: "GET" },
  );
}

export interface ApplyCcResult {
  ccId: string;
  consecutive: string;
  poolId: string;
  poolPaymentId: string;
  fromCapacity: number;
  toCapacity: number;
}

// Register the bank transfer + apply the CC's capacity to a pool.
export async function applyAccountReceivable(
  _token: string,
  id: string,
  poolId: string,
): Promise<ApplyCcResult> {
  return requestJson<ApplyCcResult>(
    `/admin/sales/account-receivables/${id}/apply`,
    { method: "POST", body: JSON.stringify({ poolId }) },
  );
}

// ─── Customer-facing redemption ───────────────────────────────────

// Summary returned by the redemption endpoint when the code matches a
// PENDING CC. Intentionally narrower than AccountReceivableRow — the
// wizard only needs what's required to lock capacity + display the
// applied banner.
export interface RedemptionSummary {
  id: string;
  consecutive: string;
  targetCapacity: number;
  currency: SaleCurrency;
  amountCop: number | null;
  amountUsdCents: number | null;
  poolType: string;
  clientLegalName: string;
  validUntil: string;
}

export async function redeemAccountReceivable(
  _token: string,
  redemptionCode: string,
): Promise<{ accountReceivable: RedemptionSummary }> {
  return requestJson<{ accountReceivable: RedemptionSummary }>(
    `/sales/account-receivables/redeem`,
    { method: "POST", body: JSON.stringify({ redemptionCode }) },
  );
}
