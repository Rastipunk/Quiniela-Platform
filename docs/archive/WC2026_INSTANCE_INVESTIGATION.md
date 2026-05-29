# WC2026 Tournament Instance Investigation

> **Status:** in progress
> **Started:** 2026-05-21
> **Trigger:** while auditing i18n on the pool zone, discovered that 63 production pools (personal + corporate, all WC2026) are pointing at a tournament instance named `[TEST] Estratega Simulation WC2026` — an instance created for internal testing that diverges functionally from the production-clean `World Cup 2026` instance.
>
> **Question we need to answer:** Where did this TEST instance come from, what was it built for, and which pools/predictions in production depend on its current state?
>
> **Why this is separate from I18N_AUDIT.md:** The TEST instance bug is orthogonal to i18n — it's a data-management problem in production. Treating it inside the i18n audit would muddy both diagnoses. The two audits run in parallel.
>
> **Method:** No assumptions. Every claim cites a commit SHA, a file path with line number, or a verified DB query.

---

## 0 — Known facts so far (verified)

### The two WC2026 instances side by side

| Field | Instance A — `e3207dff-09ad-463c-95fd-aee8ec3b2b15` | Instance B — `6eadc133-774a-4cd3-a26b-884c257330de` |
|---|---|---|
| `name` | `World Cup 2026` | `[TEST] Estratega Simulation WC2026` |
| `status` | ACTIVE | ACTIVE |
| `createdAtUtc` | 2026-01-18T18:07:51.177Z | 2026-05-12T00:58:36.200Z |
| `templateId` | `2ba7312a-ddd3-4299-93d4-29f198accf2f` (same) | (same) |
| `templateVersionId` | `d38ef12f-70f5-46f9-9cbd-9d3eed3ef533` (same) | (same) |
| `resultSourceMode` | **AUTO** | **MANUAL** |
| `apiFootballLeagueId` | **1** | **null** |
| `apiFootballSeasonId` | **2026** | **null** |
| `syncEnabled` | **true** | **false** |
| pools using it | 102 (older) | 63 (newer, since 12-may) |

### `dataJson` differences (32 fields, all in `matches[72..87]`)

The knockout-stage matches differ in `homeTeamId` / `awayTeamId`:
- A uses **dynamic placeholders**: `W_A` (winner of group A), `RU_B` (runner-up of B), `3rd_POOL_1..6` (third-place qualifiers).
- B uses **concrete team IDs**: `t_A4`, `t_B1`, `t_E4`, etc. — pre-resolved bracket.

### Diffs that DON'T exist

- Teams (48 in each, identical names verified: México, Corea del Sur, Sudáfrica, República Checa, Canadá, ...).
- Phases (6 in each, identical: Fase de Grupos, Dieciseisavos, Octavos, Cuartos, Semifinales, Final).
- Group-stage matches (`matches[0..71]`, byte-identical).
- `meta`, `sport`, `seasonYear`, `competition` keys.

---

## 1 — Where the wizard chooses an instance (verified)

- Backend `backend/src/routes/catalog.ts:14-16`:
  ```ts
  const instances = await prisma.tournamentInstance.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAtUtc: "desc" },   // newest first
    ...
  });
  ```
- Frontend `frontend-next/src/components/pool-wizard/steps/StepTournament.tsx:53-62`:
  ```ts
  return (
    instances.find((inst) => (inst as any).template?.key === entry.templateKey)
    ?? instances.find((inst) => (inst as any).templateKey === entry.templateKey)
    ?? getInstanceForEntry(entry)
  );
  ```
- Combined effect: with both instances `ACTIVE` and same template key, the newest is returned, which is instance B. That's why every WC2026 pool created after 12-may landed on B.

---

## 2 — Git history of the TEST instance

Reconstructed from commit log + filesystem mtimes + `updatedAtUtc` columns.
Every step is independently verifiable against the artifact cited.

### Step 1 — 2026-01-18: Instance A is created

- Schema row inserted: `e3207dff-09ad-463c-95fd-aee8ec3b2b15`
- name = "World Cup 2026"
- Source: `backend/src/scripts/seedWc2026Sandbox.ts` (or its predecessor).
- At this point the seed used `t_X4` static team IDs in the knockout bracket.

### Step 2 — 2026-04-03: Bracket rewrite

- Commit **`c076f80`** (`fix(wc2026): rebuild tournament instance with verified API data and official FIFA bracket`)
- Diff verified (`git show c076f80 -- backend/src/scripts/seedWc2026Sandbox.ts`): replaced static IDs with FIFA dynamic placeholders:
  ```diff
  +    { home: "RU_A", away: "RU_B", label: "2A vs 2B" },
  +    { home: "W_E",  away: "3rd_POOL_1", label: "1E vs 3er Lugar" },
  +    { home: "W_A",  away: "3rd_POOL_3", label: "1A vs 3er Lugar" },
  ```
- Sets `resultSourceMode: AUTO`, `apiFootballLeagueId: 1`, `apiFootballSeasonId: 2026`, `syncEnabled: true`.

### Step 3 — 2026-04-04: Instance A's dataJson last update

- `TournamentInstance.updatedAtUtc` for A = **`2026-04-04T00:09:10.909Z`** — verified by query.
- Inferred: the seed script (from c076f80) was run against production within hours of the commit; that's when A's bracket was upgraded to dynamic placeholders.
- A has NOT been touched since.

### Step 4 — 2026-05-11 19:58 local (= 2026-05-12 00:58 UTC): Instance B is created

- Source: `backend/scripts/estrategaSim.mjs` (filesystem mtime 2026-05-11 19:58, instance.createdAtUtc 2026-05-12T00:58:36.200Z — matches to the minute).
- File is **untracked in git** (private dev tool, never committed).
- Verified line-by-line: `estrategaSim.mjs:48-67` creates a TournamentInstance with:
  ```js
  data: {
    name: "[TEST] Estratega Simulation WC2026",
    status: "ACTIVE",          // ← bug latente: marks it as production-visible
    resultSourceMode: "MANUAL", // ← intentional for simulation
    syncEnabled: false,
    dataJson: src.dataJson,    // ← supposed to clone from A
    ...
  }
  ```
- Purpose: end-to-end testing of the Estratega flow (group standings → R32 advancement → leaderboard) without waiting for the real World Cup. The script's `phase1`/`phase2` subcommands simulate match results via the production API-confirmed path, exercising `autoPublishStructuralResults` verbatim.

### Step 5 — Unresolved discrepancy

- Script claims `dataJson: src.dataJson` (a direct clone from A).
- But verified state today (`_deep-compare-wc-instances.ts`): B has **`t_X4` static IDs**, A has **dynamic placeholders**.
- Since A's `updatedAtUtc = 2026-04-04` (i.e. A was NOT changed after creating B), A had the dynamic placeholders **at the time of the clone**.
- **This is internally inconsistent** with the only known clone path.
- Possible causes I cannot rule out from available evidence:
  - Another script (not `estrategaSim.mjs`) created B independently.
  - The `estrategaSim.mjs` source file was modified after the clone (script history is filesystem-only, no git trace).
  - The `dataJson: src.dataJson` line saw a different `src` than `e3207dff` at runtime — but the script hardcodes `WC2026_ID = "e3207dff-..."` so this requires the variable to have been mutated, which the code path doesn't allow.
- **What we know for certain:** B exists today with stale `t_X4` IDs that do NOT correspond to A's current bracket structure. The origin is opaque; the impact is clear.

### Step 6 — 2026-05-12 to today: 63 pools created against B

- Cause: `catalog.ts:14-16` returns instances `ACTIVE` ordered by `createdAtUtc DESC`. With B newer than A, the wizard's `instances.find(...)` returns B first for every WC2026 selection.
- Every WC2026 pool (personal + corporate) created since the wizard saw B as a candidate has landed on B.

---

---

## 3 — Impact on the 63 production pools

> *For each pool currently pointing at instance B, document:*
> - *member count*
> - *predictions made (Prediction / StructuralPrediction / GroupStandingsPrediction counts)*
> - *whether predictions reference the placeholder IDs (`t_A4`, `t_B1`...) — which only exist in B*
> - *whether the host has paid for capacity (so we know who's a paying customer affected)*

<!-- pending -->

---

## 4 — Options for resolution

> *Built only after sections 2 and 3 are complete.*

<!-- pending -->
