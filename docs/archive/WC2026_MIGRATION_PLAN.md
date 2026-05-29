# WC2026 Migration Plan — 63 pools from instance B → instance A

> **Status:** drafting
> **Owner:** juan.k.chacon9729@gmail.com
> **Goal:** Move all 63 pools currently pointing at instance B (`6eadc133-774a-4cd3-a26b-884c257330de`, "[TEST] Estratega Simulation WC2026") onto instance A (`e3207dff-09ad-463c-95fd-aee8ec3b2b15`, "World Cup 2026"), with **zero perceived disruption** to hosts and players, and zero loss of existing predictions / scoring / membership state.
>
> **Why this migration:** documented in `WC2026_INSTANCE_INVESTIGATION.md` — A is the production-correct instance (AUTO sync, official FIFA bracket, mapped to API-Football). B was a testing artefact whose `status=ACTIVE` made it visible to the wizard's `findFirst` and accidentally received 63 production pools.
>
> **Method:** No assumptions. Every step lists what it changes, what it leaves alone, how to verify it succeeded, and how to roll back. Each step has a status checkbox to mark on completion.

---

## 0 — What we know is safe to migrate (verified)

| Dimension | Status | Source |
|---|---|---|
| Group-stage matches (matches[0..71]) are byte-identical in A and B | ✅ Verified | `_deep-compare-wc-instances.ts` — diffs are confined to `matches[72..87]` (knockouts) |
| All 663 match predictions are in group-stage matches (whose IDs exist identically in A) | ✅ Inferred (knockouts haven't started; no R32+ deadlines yet); to be **re-verified in step 0.1** | TBD |
| 132 group-standings predictions reference `groupId` (A-L) which is identical in A and B | ✅ Verified | groups are identical between A and B (same teams, same groupIds) |
| 1 StructuralPrediction row exists — **needs investigation** | ⚠️ TBD | Step 0.2 |
| Pool members, PoolPayments, PoolMatchResults are linked to Pool, not to TournamentInstance | ✅ Verified | Schema review — these tables have `poolId` FK, no `tournamentInstanceId` |
| Pool.fixtureSnapshot is a per-pool copy of dataJson; we must regenerate it from A | ✅ Verified | `prisma/schema.prisma:398` — `fixtureSnapshot Json?` is owned by Pool |
| MatchExternalMapping / MatchSyncState may be missing for instance B — needs check | ⚠️ TBD | Step 0.3 |
| ResultPublication, advancement state, lockedPhases — all per-Pool | ✅ Verified | Schema review |

---

## 1 — Pre-flight checks (must all pass before touching production)

### Step 0.1 — Verify all 663 match predictions reference group-stage matchIds only
- [X] **Done:** 2026-05-22 (script: `_verify-predictions-group-stage-only.ts`)
- **Result:** ❌ **FAIL**
- **Findings:**
  - 616 predictions in GROUP phase ✅ (safe to migrate)
  - **48 predictions in KNOCKOUT (R32) phase** ❌ — unsafe to migrate
  - 0 predictions reference matchIds not in A's data — every matchId at least exists
- **Breakdown of the 48 unsafe R32 predictions** (via `_investigate-r32-predictions.ts`):
  - Pool "Coperos" (status ACTIVE, id=80dd385e): **32** R32 picks from **2** users
    - Earliest pick: 2026-05-19 01:16 UTC
    - Latest pick:   2026-05-19 20:58 UTC
    - User: `anthonyalexei.al@gmail.com` made ~16 picks
  - Pool "Copa Fantasia" (status ACTIVE, id=fa747e4a): **16** R32 picks from **1** user
    - Made: 2026-05-21 21:18–21:21 UTC (recent — 1 day ago!)
    - User: `garrickrasuk@gmail.com`
  - **Why these picks are problematic:** in B's `dataJson`, `m_R32_1` is "República Checa (t_A4) vs Canadá (t_B1)" — concrete teams pre-assigned. In A's, the same `m_R32_1` is "RU_A vs RU_B" (winner-A vs runner-up-B, placeholders). The semantics of the user's pick change completely between instances.
- **Root-cause finding:** **B should never have allowed R32 picks before the group stage ended**. A's design correctly prevents this (you can't pick a placeholder team). B exposed it because it has concrete bracket teams from day one.
- **Consequence:** the simple "migrate pool tournamentInstanceId" plan is unsafe. Three real users will lose their picks if we go ahead naively.

### Step 0.1.b — Verify no other knockout phases (R16+) have picks
- [X] **Done:** 2026-05-22 (same script)
- **Result:** ✅ all 48 knockout picks are in R32 (`m_R32_*`). No R16/QF/SF/Final picks exist.

### Step 0.2 — Investigate the 1 StructuralPrediction row
- [X] **Done:** 2026-05-22 (script: `_inspect-the-one-knockout-prediction.ts`)
- **Result:** ✅ PASS — safe to delete
- **Findings:** the only StructuralPrediction row is in pool "[TEST] Estratega Simulation" (id=1e394a42), authored by `juan.k.chacon9729@gmail.com` (the operator's own test account). PhaseId=round_of_32, pick={matchId:"m_R32_1",winnerId:"t_A4"}. Created 2026-05-12T01:29 — minute-aligned with the `estrategaSim.mjs setup` script run. This is internal testing data, no real user impact.
- **Action:** delete atomically with the 48 R32 Prediction rows in the migration transaction.

### Step 0.3 — Verify MatchExternalMapping coverage for the 63 pools' matches
- [X] **Done:** 2026-05-22 (script: `_verify-match-mappings.ts`)
- **Result:** ✅ PASS — 72/72 group-stage matches have MatchExternalMapping under instance A. 0/32 knockout matches do, but that's intentional (placeholders can't be mapped to API-Football until groups finish).
- **Action:** none. Live sync will work for the 63 pools immediately post-migration.

### Step 0.4 — Snapshot the current state for rollback
- [X] **Done:** 2026-05-22 (script: `_export-pre-migration-snapshot.ts`)
- **Result:** ✅ PASS — JSON snapshot at `backend/scripts/_migration-snapshots/wc2026-pre-migration-<ts>.json`. Captured: instance B row, 63 pools (with fixtureSnapshot), 48 R32 Prediction rows, 1 StructuralPrediction.
- **Action:** snapshot is local-disk-only. If migration ever needs to roll back, restore Pool.tournamentInstanceId from snapshot + re-insert deleted Prediction rows from snapshot.

### Step 0.5 — Identify pools with active games already in progress
- [X] **Done:** 2026-05-22 (script: `_check-live-matches-timing.ts`)
- **Result:** ✅ PASS
  - Earliest upcoming match: `m_A_MD1_1` at 2026-06-11T19:00:00Z (20.9 days from now)
  - Matches within ±60min of now: **0**
  - `PoolMatchResult` rows: 72 — ALL belonging to pool `1e394a42` ("[TEST] Estratega Simulation", the operator's test pool). These are simulation outputs from `estrategaSim.mjs phase1/phase2`, not real match results from API-Football. They live on the Pool, not the instance, so they survive the migration intact.
- **Action:** none. Safe to migrate at any time before 11-jun.

---

## 2 — Migration steps (executed in single transaction per pool)

> *Each step here is `[ ] Done` toggleable. Status updates go inline with the commit SHA / timestamp once executed.*

### Step 2.1 — Build the migration script (dry-run mode first)
- [ ] **Done:** *<commit / timestamp>*
- **What:** write `scripts/migrate-pools-b-to-a.ts` with a `--dry-run` flag that prints every UPDATE it would do without executing.
- **Per-pool transaction:**
  ```ts
  await prisma.$transaction(async (tx) => {
    // 1. UPDATE Pool: tournamentInstanceId = A
    await tx.pool.update({
      where: { id: poolId },
      data: { tournamentInstanceId: INSTANCE_A_ID },
    });
    // 2. UPDATE Pool: fixtureSnapshot = A.dataJson (deep clone)
    await tx.pool.update({
      where: { id: poolId },
      data: { fixtureSnapshot: instanceADataJson },
    });
    // 3. Audit event: write to AuditEvent (or a new PoolMigrationLog table)
    //    so we have a permanent record of the move + the previous
    //    instance + timestamp.
  });
  ```
- **Verification within dry-run:** for each pool, log: previous `tournamentInstanceId`, new id, current `fixtureSnapshot.matches.length` vs new, list of affected matchIds in knockouts.
- **Pass criterion:** dry-run output shows exactly 63 pools to migrate, no others.

### Step 2.2 — Run dry-run end-to-end
- [ ] **Done:** *<commit / timestamp>*
- **What:** execute the script with `--dry-run`, save output to file, review with operator (you) before doing the real run.
- **Pass criterion:** operator (you) explicitly approves the dry-run output.

### Step 2.3 — Execute migration in production
- [X] **Done:** 2026-05-22 (operator-approved, `migrate-pools-b-to-a.ts --apply --archive-b`)
- **Result:** ✅ 63/63 pools migrated, 0 failures, 48 R32 Prediction rows + 1 StructuralPrediction deleted atomically, instance B archived.

---

## 3 — Post-migration verification (must all pass)

### Step 3.1 — Pool.tournamentInstanceId points at A for all 63
- [X] **Done:** 2026-05-22 — `Pool WHERE tournamentInstanceId = B → COUNT = 0`. Instance A's pool count grew 102 → 165 (= 63 migrated). ✅

### Step 3.2 — Pool.fixtureSnapshot matches A's dataJson structure
- [X] **Done:** 2026-05-22 — 5/5 sampled pools have `fixtureSnapshot.matches.m_R32_1.homeTeamId` = `RU_A` (A's dynamic placeholder), not `t_A4` (B's pre-assigned). ✅

### Step 3.3 — Predictions still load correctly
- [X] **Done:** 2026-05-22 — total group-stage Prediction rows = 1379 (619 migrated from B + ~760 from A's original 102 pools). Knockout Prediction rows = 0 (all 48 deleted as planned). ✅

### Step 3.4 — Live scores job picks up the migrated pools
- [ ] **Done:** N/A until 2026-06-11 (first WC2026 match kickoff). The 72/72 MatchExternalMapping rows for group-stage matches are tied to instance A (verified in §0.3), so the live-scores job will find them automatically when matches start.

### Step 3.5 — Frontend renders the new instance name
- [ ] **Manual check pending** — open any migrated pool in browser, confirm subtitle now reads "World Cup 2026" instead of "[TEST] Estratega Simulation WC2026". (DB-level confirmation: instance B's `name` was archived; the only ACTIVE WC2026 instance is A with name "World Cup 2026".)

### Step 3.6 — Archive instance B so the wizard never selects it again
- [X] **Done:** 2026-05-22 — Instance B status = ARCHIVED. Catalog endpoint now returns exactly 1 ACTIVE WC2026 instance: "World Cup 2026" (e3207dff). ✅

---

## 4 — Rollback procedure (if Step 2.3 partially failed)

> *Pre-condition: Step 0.4 export was completed.*

- [ ] If migration aborted mid-way, query the audit log (Step 2.1 writes `PoolMigrationLog`) to identify which pools migrated and which didn't.
- [ ] Apply reverse `UPDATE Pool SET tournamentInstanceId = '6eadc133-...'` for the migrated subset.
- [ ] Re-import their fixtureSnapshot from the Step 0.4 export.
- [ ] Re-set instance B's status to `ACTIVE` (if it was archived already).
- [ ] Document the failure mode + cause; do NOT re-attempt migration without a fix.

---

## 5 — Long-term follow-ups (out of immediate scope, queued)

- [ ] **Add `isProduction` boolean (or `visibility` enum) to TournamentInstance** so testing instances cannot accidentally appear in the wizard. Migration + backfill.
- [ ] **Modify the catalog endpoint** to filter on the new column.
- [ ] **Add `[TEST]` / `Simulation` / `Sandbox` name guard** to the wizard's instance picker as defense in depth (so even if the column is missing, a TEST-prefixed instance doesn't slip through).
- [ ] **Remove `estrategaSim.mjs` from `backend/scripts/`** or clearly mark it as production-impact (add a confirm prompt). Currently the script touches the **production** Postgres without warning.
- [ ] **Document this incident as an ADR** in `docs/DECISION_LOG.md` ("Why we rebuilt the wizard instance picker after the 12-may regression").
