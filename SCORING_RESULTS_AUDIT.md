# Scoring vs Results — Forensic Audit (empate + penales)

> Trigger: a Champions pool's **final ended 1-1** (drawn in regulation,
> decided on penalties) and "still has no final result". The
> marcador-exacto / predictor scoring "should have registered 1-1" and
> didn't.
>
> Goal: establish, **from the real code with no assumptions**, exactly
> which result each scoring form reads, how a result is published/
> finalized, and where an empate+penales can get stuck — so we can
> design a well-built fix. **No code changed.**
>
> Verified against `origin` on branch `docs/repo-audit-2026-05`,
> 2026-06-01.

---

## 1. The data model of a match result

`PoolMatchResultVersion` (`schema.prisma:633-682`) stores, per published
version:

| Field | Meaning |
|---|---|
| `homeGoals` / `awayGoals` | Score at the end of played time (regulation, **including extra time if any**, **excluding penalties**). |
| `homeGoals90` / `awayGoals90` | Score at minute 90. **Only populated when the match went to extra time** (`AET`/`PEN`); otherwise `null`. |
| `homePenalties` / `awayPenalties` | Penalty shootout goals (knockout only). |
| `source` | `HOST_MANUAL` / `HOST_PROVISIONAL` / `SCRAPER_PROVISIONAL` / `API_CONFIRMED` / `HOST_OVERRIDE`. |
| `status` | `PUBLISHED` (current version pointer in `PoolMatchResult.currentVersionId`). |

Structural results are separate:
- `StructuralPhaseResult.resultJson` = `{ matches: [{matchId, winnerId}] }` for KNOCKOUT_WINNER (`schema.prisma:709-733`).
- `GroupStandingsResult.teamIds[]` = ordered group positions.

**Takeaway:** the marcador lives in `PoolMatchResultVersion`; the
"quién gana/avanza" lives in `StructuralPhaseResult`. They are populated
by different paths and can succeed or fail independently.

---

## 2. The scoring forms (4 presets) and what each reads

Presets (`types/pickConfig.ts:150-154`): **BASIC**, **CUMULATIVE**,
**SIMPLE**, **CUSTOM**. The per-phase switch is `requiresScore`
(`pickConfig.ts:120-137`): a phase is **mutually exclusively** either
match-based (marcador) or structural.

### The governing rule (declared, `pickConfig.ts:124-130`)
> `includeExtraTime=true` → scoring uses the end-of-extra-time score.
> `false` (default) → scoring uses the **minute-90** score.
> **Penalties are NEVER counted for scoring.**

### What each form actually reads (verified in code)

| Form | `requiresScore` | Reads | Where |
|---|---|---|---|
| **BASIC** (marcador exacto) | true | `includeExtraTime ? homeGoals : (homeGoals90 ?? homeGoals)` per pick type EXACT_SCORE | `poolOverviewService.ts:424-425`, `resultService.ts:305-306`, `poolAdminService.ts:941/968/1146/1166`, engine `scoringAdvanced.ts:289` |
| **CUMULATIVE** (HOME_GOALS + AWAY_GOALS + OUTCOME + DIFF) | true | same `homeGoals90 ?? homeGoals` mapping, then compares each component | `scoringAdvanced.ts:83-103, 289-330` |
| **SIMPLE** (Estratega / structural) | false | `StructuralPhaseResult.matches[].winnerId` (knockout) or `GroupStandingsResult.teamIds` (groups) | `structuralScoring.ts` (GROUP_STANDINGS + KNOCKOUT_WINNER only) |
| **CUSTOM** | per phase | mix of the above | — |

**The mapping is consistent everywhere** (`includeExtraTime ? homeGoals : (homeGoals90 ?? homeGoals)`). For a final that ended 1-1 and went to penalties:
- `homeGoals = 1`, `awayGoals = 1` (regulation+ET, no penalties).
- `homeGoals90 = 1`, `awayGoals90 = 1` (set because status is `AET`/`PEN`, `liveScoresJob.ts:300-302`).
- → **Either `includeExtraTime` setting yields 1-1.** The marcador engine, given a published result, *would* score 1-1 correctly. Penalties never enter the marcador. **This part of the design is correct.**

**Conclusion for the marcador/predictor symptom:** if the predictor did
NOT score 1-1, the most likely cause is that **the result was never
published/finalized for that match** — not that the engine read the
wrong field. Symptom 2 ("no 1-1") is downstream of symptom 1 ("no final
result").

---

## 3. How a result gets published & finalized (scraper-first, AUTO mode)

`liveScoresJob.processLiveScore` (`liveScoresJob.ts:165-262`):

1. `isFinished = FINISHED_STATUSES.includes(score.status)`.
   `FINISHED_STATUSES = ['FT','AET','PEN']` (`apiFootball/types.ts:158`) — **penalty finishes ARE recognized.**
2. On first FT/AET/PEN → start a grace period (`SCORES.GRACE_PERIOD_MS`, default 5 min). Until it expires, the match is published as `SCRAPER_PROVISIONAL` (`publishScraperResult`, line 253).
3. After grace expires → `finalizeResult()` upgrades `SCRAPER_PROVISIONAL → API_CONFIRMED` (line 248-250).
4. `homeGoals90/awayGoals90` are set **only** when `status ∈ {AET, PEN}` (line 300-302); penalties stored from `score.penaltyHome/Away` (line 355-356).
5. Authoritative sources are never overwritten: existing `API_CONFIRMED` / `HOST_OVERRIDE` short-circuit (line 278-284).

Structural auto-publish (`structuralAutoPublish.ts`, CLAUDE invariant 8)
runs after a match finalizes and derives `winnerId`
(`structuralAutoPublish.ts:232-247`):
```
if (homeGoals > awayGoals) winner = home
else if (awayGoals > homeGoals) winner = away
else {                                  // tied in regulation+ET
  if (homePenalties > awayPenalties) winner = home
  else if (awayPenalties > homePenalties) winner = away
  else  /* line 243 */  winner = null   // tied on penalties → invalid, no winner
}
/* line 247 */  // tied at 90'+ET with NO penalties recorded yet → WAIT (winner stays null)
```
If `winnerId` is `null`, the structural result is **not published — it waits.**

---

## 4. Where an empate+penales can get stuck (candidate root causes)

These are the code-level failure points. Which one applies to the
owner's final needs the prod data in §5 — I am **not** assuming which.

- **C1 — Penalties never recorded on the version.** If the scraper
  reported the match as `FT` with 1-1 (instead of `PEN`) and without
  `penaltyHome/Away`, then: marcador publishes fine as 1-1 (so a
  predictor pool *should* score it), BUT structural `deriveWinner`
  hits line 247 (`winner=null`) and **never publishes the structural
  result** → a SIMPLE/Estratega pool's final stays unresolved. Asymmetry
  between the two scoring families.
- **C2 — Match never reached a finished status in our system.** If the
  fixture isn't mapped to the scraper (no `MatchSyncState`/fixture
  tracking), or the instance isn't in AUTO mode, `processLiveScore`
  never runs for it → no `PoolMatchResult` row at all → **both** marcador
  and structural have nothing → predictor can't score 1-1. This fits
  "still has no final result" most literally.
- **C3 — Stuck at `SCRAPER_PROVISIONAL`.** If FT was detected but the
  grace-period finalize never ran (job stopped, fixture dropped from the
  live set before grace expired), the row stays `SCRAPER_PROVISIONAL`.
  It *should* still score (provisional has a score), so this alone
  doesn't explain "predictor didn't score 1-1" unless the pool/overview
  path filters provisional — **to verify**.
- **C4 — The final as a structural phase has no "next phase".**
  KNOCKOUT_WINNER means "who advances". The final's winner is the
  champion, not an advancer. `deriveWinner` is generic per-match so it
  *should* still emit a `winnerId` for the final's match — but whether
  the final is even modeled as a structural phase (vs a marcador phase)
  in this pool decides if a structural result is expected at all.
  **Depends on the pool's `pickTypesConfig`.**

---

## 5. What only prod data can answer — queries to run

Run these (Railway → Postgres → Data/Query). Replace `:poolId` with the
Champions pool's id and `:matchId` with the final's match id (from the
instance snapshot). This pins down which of C1-C4 applies, with zero
assumptions.

**5.1 — Does a result exist, and in what state?**
```sql
SELECT v."versionNumber", v.status, v.source,
       v."homeGoals", v."awayGoals", v."homeGoals90", v."awayGoals90",
       v."homePenalties", v."awayPenalties", v."publishedAtUtc"
FROM "PoolMatchResult" r
JOIN "PoolMatchResultVersion" v ON v."resultId" = r.id
WHERE r."poolId" = ':poolId' AND r."matchId" = ':matchId'
ORDER BY v."versionNumber";
```
- No rows → **C2** (never finalized / not mapped).
- `source = SCRAPER_PROVISIONAL` and never `API_CONFIRMED` → **C3**.
- Rows with `homeGoals=1, awayGoals=1` but `homePenalties IS NULL` → **C1** (structural can't derive winner).

**5.2 — Is the fixture mapped to the scraper / what status did it last see?**
```sql
SELECT "internalMatchId", "lastApiStatus", "syncStatus",
       "graceEndUtc", "completedAtUtc", "lastCheckedAtUtc"
FROM "MatchSyncState"
WHERE "internalMatchId" = ':matchId';
```
- No row, or `lastApiStatus` never in (`FT`,`AET`,`PEN`) → **C2**.
- `syncStatus = AWAITING_FINISH` stuck → grace/finalize problem (**C3**).

**5.3 — Was a structural result published for the final's phase?**
```sql
SELECT "phaseId", "resultJson", "publishedAtUtc"
FROM "StructuralPhaseResult"
WHERE "poolId" = ':poolId';
```
- Final's phase absent / its `matches[]` lacks the final's `winnerId` → **C1/C4** (structural never resolved).

**5.4 — Which scoring form is this pool, and is the final a structural or marcador phase?**
```sql
SELECT "scoringPresetKey", "pickTypesConfig"
FROM "Pool" WHERE id = ':poolId';
```
- Look at the final phase's `requiresScore` in `pickTypesConfig`:
  `true` → predictor/marcador (expects a `PoolMatchResultVersion`);
  `false` → Estratega/structural (expects a `StructuralPhaseResult` winnerId).

---

## 6. How it *should* be (target behavior)

- **Marcador (BASIC/CUMULATIVE):** a 1-1 final scores as 1-1 regardless
  of penalties. ✅ Already correct in the engine — the gap, if any, is
  purely in publication/finalization (C2/C3).
- **Structural (SIMPLE/Estratega):** a drawn knockout match MUST resolve
  its `winnerId` from penalties. The code supports this **only if
  `homePenalties/awayPenalties` are recorded**. If a tied match finalizes
  without penalties captured, the structural result silently waits
  forever (line 247) with no operator signal — this is the most likely
  structural defect and is **fixable** (e.g. surface a "needs penalty
  result" admin alert + a host override path, and/or ensure the scraper/
  finalize step always captures the shootout for `PEN` fixtures).
- **The final specifically:** confirm the final is modeled as the
  scoring family the owner expects. A "predictor" pool's final should be
  a `requiresScore=true` marcador phase; if it was configured structural,
  the predictor never had a marcador phase to score.

---

## 7. Next step (before any fix)

Run §5.1-5.4 for the affected pool + final match and paste the rows. With
those four results we identify C1/C2/C3/C4 exactly, then design the fix
against the real failure — not a guess. The fix will almost certainly be
one or both of:
1. **Finalization robustness** for `PEN` fixtures (capture penalties;
   don't leave structural results waiting silently — alert + override).
2. **Operator visibility**: a drawn-knockout-without-winner state should
   raise an admin flag, not fail silent.

---

## 8. Root cause — CONFIRMED with prod data (2026-06-02)

Instance `ucl-2025-instance` ("Champions League 2025-26"), final
`matchId = "final"` (PSG vs ARS, kickoff 2026-05-30 16:00 UTC). All
Champions pools are preset **CLASSIC** (marcador). Observed state:

- **`MatchSyncState`**: `lastApiStatus = "NS"` (Not Started),
  `syncStatus = IN_PROGRESS`, `graceEndUtc = null`,
  `completedAtUtc = null`, last checked 2026-05-30 18:59 — ~3 h after
  kickoff, yet the status says the match never started.
- **`PoolMatchResultVersion`** (every pool: AON, Dieguismo, Tamayo,
  Quiniela Champions, q champions, Prueba 1): `1-1`, but
  `homeGoals90 = null`, `homePenalties = null`,
  `source = SCRAPER_PROVISIONAL`. Never upgraded to `API_CONFIRMED`.

**What happened (it is C2+C3, with a twist):**
1. The scraper published the live 1-1 (provisional) while the match was
   on, so a `SCRAPER_PROVISIONAL` row exists with `1-1`.
2. The scraper then **lost the fixture** — its last reading reverted to
   `"NS"`. It **never delivered a terminal status** (`FT`/`AET`/`PEN`).
3. Because `isFinished` never became true (`liveScoresJob.ts:169,200`),
   the grace period never started and **`finalizeResult` never ran** →
   the row is frozen at `SCRAPER_PROVISIONAL` and `syncStatus` stays
   `IN_PROGRESS`. The system believes the match is still live.
4. `homeGoals90`/`homePenalties` are null because the scraper never
   reported `AET`/`PEN` — so the penalty result (the champion) was never
   captured.

**Why the API-Football fallback didn't rescue it:** the fallback
(invariant 7) keys off "30 min past estimated FT". With `lastApiStatus`
stuck at `NS`, the system thinks the match hasn't started, so it never
computes "FT + 30 min" → the fallback never triggers. **A bad `NS`
status blocks BOTH scraper finalization AND the API-Football fallback —
the match lands in a permanent limbo.** This is the core defect.

**On "the predictor didn't show 1-1":** the leaderboard
(`poolOverviewService.ts:104`) reads `currentVersion` **without**
filtering by `source`, so the provisional 1-1 *does* score. But the
match is rendered as not-final / in-progress (provisional +
`IN_PROGRESS`), so to the user it looks unresolved — the result never
"closed". (Verify the actual leaderboard if exact points are in doubt.)

## 9. Proposed fix (two levels)

**A — Operational, unblock the final now (no deploy):** publish the
final result via the HOST_OVERRIDE path (1-1; add penalties/winner if
any pool needs the structural champion). That writes an authoritative
version and closes the match. CLASSIC pools only need the 1-1.

**B — Root fix (code, design):** stop matches from getting stuck when
the scraper goes silent / reverts to a non-terminal status:
1. **Stale-live detection:** if a match is past `kickoff + max expected
   duration` (e.g. 150 min for 90', or 180 min to allow ET+pens) and
   still not finalized, treat it as needing resolution instead of
   trusting a stale `NS`/in-play status.
2. **Force the API-Football fallback on staleness**, not only on
   "estimated FT + 30" — so a bad scraper status can't suppress it.
3. **Admin alert** for "match should be over but isn't finalized" (and
   for drawn-knockout-without-penalties, per §6) — never fail silent.
4. Consider a time-based finalize of an existing provisional score once
   well past expected end, with the source marked accordingly.

## Document version
- v1 — 2026-06-01 — code audit complete; awaiting prod data (§5).
- v2 — 2026-06-02 — root cause confirmed (§8): scraper reverted to `NS`,
  blocking both finalization and the API-Football fallback; result
  frozen at SCRAPER_PROVISIONAL. Fix proposed (§9).
