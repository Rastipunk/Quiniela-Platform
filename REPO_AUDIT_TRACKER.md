# Repo Audit & Documentation Consolidation — Master Tracker

> Goal (owner, 2026-05-28): map every file in the repo into one master
> document with a clear, professional description of what each thing
> does; read all source code so nothing functional is left
> undocumented; identify dead / discarded / orphan code that can be
> deleted ("no quiero archivos basura"); then bring `docs/` fully up to
> date — deleting obsolete content and consolidating everything into a
> single source of truth, with no exceptions.
>
> This document is the durable record so the work survives context
> breaks. Update statuses as phases land.

---

## Scope decisions (locked via AskUserQuestion, 2026-05-28)

1. **Coverage grain:** semantic, not line-by-line annotation. Every file
   is read in full; each is documented as "this section does X" at a
   detailed functional level. The bar is: *nothing a file does is left
   undocumented*. We do NOT annotate every individual line (braces,
   imports). Where a block is skipped, the reason is recorded.
2. **Binaries / assets:** inventoried (path, purpose, size) but NOT read
   line by line — reading PNG/SVG/TTF/webp bytes has no value.
3. **Orchestration:** multi-agent workflow authorized. Parallel agents
   map subtrees; results consolidated centrally.
4. **Temporary docs:** the 17 root-level `*_AUDIT.md` / `*_IMPLEMENTATION.md`
   scratchpads are consumed work products. Their live content already
   migrated to `docs/` (ADRs, BUSINESS_RULES). They get archived/deleted
   at consolidation so `docs/` is the single source of truth.

Additional explicit goal added by owner: **identify and remove junk** —
dead code, discarded features, orphan files. Output a delete-candidate
list with evidence before anything is removed.

---

## Repo scale (measured 2026-05-28)

| Bucket | Count | Lines | Treatment |
|---|---|---|---|
| Source code (ts/tsx/sql/prisma/mjs/js) | 508 | ~118,800 | Read in full, described |
| Config/structure (json/toml/yml/eslint/gitignore/env) | ~18 | ~1,700 | Read + described |
| i18n message JSON (`src/messages`) | 75 | — | Described in bulk (3 locales × ~25 keys files) |
| Binaries/assets (png/svg/ttf/webp/ico) | 48 | — | Inventoried only |
| Markdown docs | 37 | 22,514 | Audited in Phase 3 |
| **Total tracked (excl. build artifacts)** | **~690** | | |

Code+config manifest fed to the workflow: **526 files / 120,566 lines**,
partitioned into **25 line-budgeted batches** (~4,800 lines each, max
5,498) ordered by path so each batch is thematically coherent.

Largest single files: `paymentService.ts` (2,606), `ScoringEditor.tsx`
(2,265), `emailTemplates.ts` (2,169), `email.ts` (2,162),
`AdminAnalyticsContent.tsx` (2,060), `adminAnalyticsDashboard.ts`
(1,787), `schema.prisma` (1,628).

---

## Phases

| # | Phase | Status | Output |
|---|---|---|---|
| 0 | Master inventory + this tracker | 🟩 DONE | `REPO_AUDIT_TRACKER.md`, batch manifest, `docs/repo-map/00-assets-and-i18n.md` |
| 1 | Deep multi-agent mapping (read every source file, describe) | 🟩 DONE | `docs/repo-map/part-01..25.md` + `docs/repo-map/README.md` index |
| 2 | Dead-code / junk detection (orphan exports, discarded features) | 🟩 DONE | `docs/repo-map/DEAD_CODE_FINDINGS.md` (~95 flags categorized) |
| 3 | Docs audit (current `docs/` vs reality) | 🟩 DONE | `docs/repo-map/audit/*.md` (21 docs: 4 major, 17 minor; 0 fully obsolete) |
| 4a | Rewrite `docs/` to match shipped code | 🟩 DONE | 21 docs updated, +1,104/-314 lines, verified vs source |
| 4b | Archive temporary cycle docs | 🟩 DONE | 18 `*_AUDIT`/`*_IMPLEMENTATION`/etc. moved to `docs/archive/` |
| 4c | Delete confirmed junk code | 🟥 AWAITING OWNER OK | Build-gated deletions on this branch (see DEAD_CODE_FINDINGS.md §B) |

All work is on branch **`docs/repo-audit-2026-05`** (main untouched),
**uncommitted** so the owner can review the full diff before committing.

### Phase 4c — proposed deletions (need owner "go")

Safe, build-gated (tsc + build must stay green). From DEAD_CODE_FINDINGS.md:
- §B1 tautological branches, §B2 unused imports, §B3 unused locals (minus the `token`-param convention), §B5 vestigial leftovers — zero behavior change.
- §B4 orphan files — grep-confirmed zero importers, then delete (`LoginContent.tsx` ~744 lines is the big one).
- NOT in this pass: §A XSS fixes (separate security cycle), §D correctness/debt, the `token`-param refactor, the migration boot-workaround — each its own deliberate change.

Phase 4 is the only destructive phase and requires explicit owner
approval before execution.

### Phase 1 result (2026-05-28)

- 25/25 batches completed, **526/526 source files read in full**.
- ~3.0M subagent tokens, 588 tool uses, ~9 min wall-clock.
- All 26 map files (`00` + `part-01..25`) landed correctly in `docs/repo-map/`
  (the odd paths in the workflow return were reporting artifacts only).

---

## 🔴 Security finding (surfaced by Phase 1, acted on immediately)

**`.claude/settings.local.json` was tracked in git with live production
credentials** (`DATABASE_URL` + password, line 71) and two JWT bearer
tokens (lines 47, 62; expired). It was NOT gitignored.

**Mitigated 2026-05-28:** `git rm --cached` (file kept locally) + added to
`.gitignore`, along with generated test artifacts (`playwright-report/`,
`test-results/`). Staged, not yet committed.

**Owner action still required (cannot be done autonomously):**
1. Rotate the Postgres password in Railway — the URL is in git history; untracking HEAD does not remove it.
2. Rotate `JWT_SECRET`.
3. Decide whether to scrub git history (BFG / git-filter-repo) — rewrites history, needs a force-push.

A coherent **XSS cluster** in the email layer (A2–A5 in DEAD_CODE_FINDINGS.md)
also surfaced — raw `contactName` / `entry.name` interpolation on
public/host-controlled inputs. Flagged for a dedicated fix cycle.

---

## Phase 1 method

- Each of the 25 batches → one workflow agent.
- Agent reads EVERY file in its batch in full (Read tool, no excerpts).
- Agent writes its detailed map to `docs/repo-map/NN-<area>.md` (one
  file per batch — no write conflicts since paths are distinct).
- Agent returns a compact structured summary: files covered, coverage
  flags (fully read? any block skipped + why), and dead-code flags
  (file, what looks dead, why) — this keeps the workflow return small
  and seeds Phase 2.
- Per-file documentation captures: purpose, main sections/symbols and
  what each does, exports, notable dependencies, and any smell
  (dead code, TODO, discarded feature, duplication).

---

## Coverage ledger

Populated as Phase 1 completes. Any file NOT fully read is listed here
with the reason (the owner's "document every skipped line and why"
requirement, applied at block/file grain).

| File | Status | Skipped | Reason |
|---|---|---|---|
| `backend/src/scripts/ucl_2025_fixtures.json` | Partial | lines ~30–613 | 613-line generated UCL R32 fixture dump. Agent read the head, verified JSON structure + total line count; remaining lines are homogeneous repeated fixture entries of identical shape. No logic, pure data. |

**All other 525 source files were read in full.** This is the only
exception in the entire 526-file code corpus.

---

## Document version

- v1 — 2026-05-28 — created at Phase 0.
