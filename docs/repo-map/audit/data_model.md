## Audit: docs/DATA_MODEL.md

**Overall verdict: UPDATE (major).** The doc is a faithful description of the schema *as of ~2026-05-03*, but the schema has since grown three entire models, three enums, and ~18 new fields that the doc never mentions. There is nothing *obsolete* (no Wompi/Lemon-Squeezy ghosts here — the doc correctly already documents the dual Polar/MP gateway), but there are several **missing** sections and a couple of small **incorrect**/stale details. Ground truth: `backend/prisma/schema.prisma` (1629 lines).

---

### Finding 1 — Sales Management models entirely missing (MISSING, major)
**Section:** §2 Enums, §3 Models (TOC), §4 Relationship Diagram.
**What's wrong:** The schema ships three sales models — `Quote` (schema.prisma:1456), `AccountReceivable` (1525), `DocumentCounter` (1616) — and three enums — `QuoteStatus` (1519), `AccountReceivableStatus` (1604), `DocumentKind` (1625). The doc documents NONE of them. This is the entire "cuenta de cobro / cotización" stack (ADR-061) backed by `backend/src/services/sales/*` and `backend/src/routes/adminSales.ts`, `salesRedemption.ts`.
**Fix:** Add §3.33 Quote, §3.34 AccountReceivable, §3.35 DocumentCounter with full field tables, add the three enums to §2, and add them to the TOC + relationship diagram. Note the `AccountReceivable.poolPaymentId` ↔ `PoolPayment.accountReceivableId` 1:1 link.

### Finding 2 — `PaymentStatus` enum referenced but never defined (MISSING, major)
**Section:** §2 Enums; §3.28 PoolPayment.
**What's wrong:** §3.28 lists `status | PaymentStatus | Default: PENDING | ... INITIATED / PENDING / COMPLETED / FAILED / ABANDONED / EXPIRED / CANCELLED / REFUNDED`, but §2 has no `PaymentStatus` entry. The enum is defined at schema.prisma:1230 with 8 values and per-value semantics in comments.
**Fix:** Add a `PaymentStatus` subsection to §2 enumerating all 8 values with the lifecycle descriptions from the schema comments.

### Finding 3 — User model missing locale + welcome-email fields (MISSING, major)
**Section:** §3.1 User.
**What's wrong:** The User table omits four shipped columns: `locale` (String? VarChar(2), schema:120), `requestedLocale` (String? VarChar(8), schema:121), `localePromptCompletedAt` (DateTime?, schema:122), and `welcomeEmailSentAt` (DateTime?, schema:133). These back the locale-resolution architecture (ADR-064) and the welcome-email handoff (ADR-063) — both flagged as live in project memory. Also missing the three sales back-relations: `quotesCreated`, `accountReceivablesCreated`, `accountReceivablesRedeemed` (schema:184-186).
**Fix:** Add the four fields under a "Communication Locale" group and the three relations to the Relations list.

### Finding 4 — Pool model missing pending-approval digest throttle fields (MISSING, minor)
**Section:** §3.6 Pool.
**What's wrong:** The Pool table omits `pendingDigestPendingHash` (String?, schema:461) and `pendingDigestStreakStartAt` (DateTime?, schema:462) — the ADR-058 daily pending-approval digest throttle (migration `20260504_add_pending_digest_throttle`).
**Fix:** Add both fields with the streak/hash semantics from the schema comment.

### Finding 5 — Organization missing `invitationLocale` (MISSING, minor)
**Section:** §3.25 Organization.
**What's wrong:** Schema:1094 has `invitationLocale String @default("es")` (ADR-062, governs the first corporate-activation email only). The doc's Organization table does not list it.
**Fix:** Add `invitationLocale | String | Default: "es" | First-contact email locale; User.locale takes over post-activation`.

### Finding 6 — OrganizationInquiry missing all quote fields (MISSING, major)
**Section:** §3.26 OrganizationInquiry.
**What's wrong:** Schema:1163-1173 adds `country` (String?), `currency` (String?), `numberOfPools` (Int?), `slotsPerPool` (Int?), and `poolsConfigJson` (String?) — the `/empresas` quote-panel fields (migrations `20260429_extend_organization_inquiry_quote_fields` + `20260429_add_pools_config_json_to_inquiry`). None are documented.
**Fix:** Add the five fields with the source-of-truth note for `poolsConfigJson` vs `slotsPerPool`.

### Finding 7 — MatchSyncState missing live-tracking fields (MISSING, major)
**Section:** §3.22 MatchSyncState.
**What's wrong:** Schema:965-969 adds five picks4all-scores live-tracking columns the doc omits: `trackedAtUtc`, `graceEndUtc`, `lastElapsed` (Int?), `lastExtra` (Int?), `lastLiveDataJson` (Json?). These come from migrations `20260410_add_live_tracking_fields` and `20260411_add_last_extra_to_match_sync_state`.
**Fix:** Add the five fields. The doc's state-machine prose (§1.4) is otherwise accurate but predates the scraper/grace-period integration; consider noting the grace window.

### Finding 8 — PoolPayment missing `mpPaymentId` and CC link (MISSING, major)
**Section:** §3.28 PoolPayment.
**What's wrong:** The PoolPayment table omits `mpPaymentId` (String?, schema:1318 — MP's real `payment.id`, set on first IPN, used by the MP reconciler; migration `20260527_add_mp_payment_id_and_status_index`) and the `accountReceivableId` (String? @unique, schema:1331) + `accountReceivable` relation that 1:1-links a payment to the cuenta de cobro it fulfilled. The doc also omits the `@@index([status, createdAtUtc])` compound index (schema:1342) used by both reconcilers.
**Fix:** Add `mpPaymentId`, `accountReceivableId`/`accountReceivable` relation, and the compound status index. Add the AccountReceivable relation to the Relations list.

### Finding 9 — Pool indexes/relations: doc misses `payments` relation naming (INCORRECT, minor)
**Section:** §3.6 Pool Relations.
**What's wrong:** The doc lists Pool relations through `matchOverrides` but stops there. Schema:477 adds `payments -> PoolPayment[]`. The doc's Pool relation list ends at `matchOverrides` and never lists `payments` (it IS shown in the §4 diagram, but missing from the §3.6 Relations bullet list).
**Fix:** Add `payments -> PoolPayment[] (1:N)` to the §3.6 Relations list for consistency.

### Finding 10 — CorporateInvite token byte count (OK — verified)
**Section:** §3.27 CorporateInvite.
**What's wrong:** Nothing. The doc says "32-byte crypto token (64 hex chars) via `crypto.randomBytes(CRYPTO_BYTES.TOKEN)`". Confirmed: `CRYPTO_BYTES.TOKEN = 32` in `backend/src/lib/constants.ts:19`. (Note: MEMORY.md's "48 bytes" claim is the stale one, not the doc.) Marked OK to prevent a wrong "fix".

### Finding 11 — Relationship diagram out of date (INCORRECT, minor)
**Section:** §4 Relationship Diagram.
**What's wrong:** The ASCII diagram has no Quote/AccountReceivable/DocumentCounter nodes, no User→Quote/AR edges, and PaymentEvent's relation note "(idempotency log, FK by polarEventId)" is imprecise — the FK to PoolPayment is `poolPaymentId` (schema:1379-1380), not `polarEventId` (which is just the gateway event id / idempotency anchor, not the relation key).
**Fix:** Add the sales nodes/edges; correct the PaymentEvent edge label to "FK by poolPaymentId; polarEventId is the gateway idempotency anchor".

### Finding 12 — Header date stale (INCORRECT, trivial)
**Section:** Header.
**What's wrong:** "Last updated: 2026-05-03" predates migrations through `20260527_*`. After applying the above, bump it.
**Fix:** Update the date and add a one-line note that it now reflects schema through migration 20260527.
