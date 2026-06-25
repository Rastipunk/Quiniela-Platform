# Leaderboard "Evolución" Tab — Plan (2026-06-25)

**Goal.** A new **"Evolución"** tab in the pool leaderboard: an animated line
chart showing each player's **cumulative points** match-by-match in chronological
order. The viewer's own line is highlighted; lines cross naturally when someone
overtakes another; the current standing is marked at the right edge; tapping a
point shows the standings as they were at that moment. Must be **dynamic and
eye-catching** (engagement feature) and **mobile-first** (360–430px).

---

## 1. Owner decisions (locked 2026-06-25)

- **Chart = cumulative POINTS** (Y axis = accumulated points). Lines cross on
  overtakes by construction; no separate "position" chart for v1.
- **Final position** shown at the end of each line (right edge).
- **Tap a match/step** → tooltip with that step's standings + each player's gain.
- **Viewer's line highlighted** (thick, brand color, label pinned); others muted.
- **Animated draw-in** on load (curve reveals left→right) — the "wow".
- **X axis = individual match labels** (not phase bands). The chart is wider than
  the screen and **scrolls horizontally**, opening **pinned to the right (most
  recent)** — people care about the latest movements. Phase markers overlaid as
  bands/dividers on top of the labels. (Decision 2026-06-25.)
- **"Descargar PDF" of the FULL chart** — a print view renders all 53 steps at
  full width; the user saves it as PDF via the browser's native print-to-PDF
  (zero new deps). (Decision 2026-06-25.)
- **Performance principle (owner):** centralize the calculation; recompute ONLY
  when an input actually changes; players only READ — never recompute per view.
- **Snapshot persistence:** NOT a new DB column. Ride the existing **ADR-079
  leaderboard cache** (see §4). This supersedes the earlier "Pool.evolutionSnapshot
  column" idea — reusing the owner's recent over-calc fix.

---

## 2. Feasibility — verified against prod + code (no assumptions)

- **Per-match points are computable** and already computed transiently inside the
  leaderboard loop (`computeLeaderboardBundle` in
  `backend/src/services/poolOverviewService.ts`, the O(members×matches) loop ~473-646;
  per-match increment at ~528-534 advanced / ~565-566 legacy; verbose `breakdown[]`
  at ~542-582). The scoring engine `scoreMatchPick`
  (`backend/src/lib/scoringAdvanced.ts:47-154`) is a **pure per-match** function.
- **Chronology:** kickoff time = `FixtureMatch.kickoffUtc` in the pool's
  `fixtureSnapshot` JSON (`backend/src/lib/fixture.ts:37-51`). Order by
  `kickoffUtc`; **simultaneous = equal `kickoffUtc`** (already how the pool page
  sorts matches, `pools/[poolId]/page.tsx:369-374`). Only **finalized** matches
  are plotted.
- **Charting:** `recharts ^3.8.1` is **already installed**
  (`frontend-next/package.json:25`, used in `AdminAnalyticsContent.tsx`). No new dep.
- **Tabs are centralized:** `frontend-next/src/components/pool/PoolNav.tsx`
  (`PoolNavTab` union ~33-41, `VALID_TABS` ~43-52, `PLAYER_ITEMS` ~60-65) +
  render branch in `pools/[poolId]/page.tsx` (~794-875, leaderboard branch ~869-875).
- **Test pool (prod):** **"Polla Coronada"** (`8fd46a05-3d67-420b-a678-56e81376e83e`),
  ACTIVE, World Cup 2026, owner `juan.k.chacon9729@gmail.com`. **11 active players,
  56 finalized match results, ALL 6 phases score-based per-match** (progressive
  points: groups ×1 = 10 → final ×5 = 50). Ideal: rich data, no structural-phase
  complication, dramatic late swings.

---

## 3. Estratega / structural pools (deferred — not needed for the test)

In SIMPLE/Estratega pools, points are computed **per phase**, not per match
(`computeStructuralBreakdown`, `poolOverviewService.ts:593-626`):
- **Group stage** = GROUP_STANDINGS → resolves once at end of the phase → **one
  step** (single jump), cannot be attributed to individual matches.
- **Knockouts** = KNOCKOUT_WINNER (pick who advances) → currently scored **per
  round**, not per match. Could be attributed per-match later (each advancer = one
  match) with extra work, or shown per-round (simpler).

**Decision:** v1 targets score-based (per-match) pools. For structural pools the
series falls back to **per-phase steps** (group = 1 step, each knockout round =
1 step). Polla Coronada is fully per-match, so this is moot for the test.

---

## 4. Architecture — centralized compute, ride ADR-079 cache

The owner's recent **ADR-079** (`poolLeaderboardCache.ts`) already implements
"recompute only when inputs change, serve cached to everyone": a per-pool
in-memory cache keyed by a cheap **fingerprint** of
results/overrides/membership/predictions/structural results
(`computeLeaderboardFingerprint`, `poolOverviewService.ts:37-64`) + a 20s TTL
safety net. The fingerprint covers **every input the evolution depends on**.

Plan:
1. **Centralize the per-match calc.** Extract the per-(player, match) points
   computation into ONE shared helper used by both the leaderboard rows and the
   evolution series → they can never diverge. (Today it's inline in the loop.)
2. **Build the evolution series inside the cached bundle.** From the per-match
   increments already computed, produce: ordered steps (by `kickoffUtc`,
   simultaneous grouped) + each player's cumulative array. Cost is marginal
   (the heavy scoring already ran). Store it in the **same bundle** the ADR-079
   cache holds → invalidated by the same fingerprint, served read-only.
3. **Players only read.** A view = a cache hit (no recompute). Recompute happens
   at most once per ~20s per pool, only when an input changed — exactly the
   owner's principle. No new persistence, no per-view recompute.

> If profiling ever shows the 20s refresh is too much, upgrade path = persist the
> series and regenerate strictly on the result-publish/membership-change events.
> Not needed now.

---

## 5. Data shape (endpoint payload)

`GET /pools/:poolId/evolution` (reads the cached bundle; returns the evolution slice):

```ts
{
  steps: Array<{
    index: number;          // 0..N-1 chronological
    phaseId: string;        // group_stage | round_of_32 | ...
    kickoffUtc: string;     // ISO; ties = simultaneous (same step)
    matchIds: string[];     // matches resolved at this step
    label: string;          // short label (teams / date) — refine later
  }>;
  players: Array<{
    userId: string;
    displayName: string;
    isViewer: boolean;      // matched server-side at read time (no recompute)
    cumulative: number[];   // length === steps.length, points after each step
  }>;
  // position at any step + final position are derived client-side
  // (sort players by cumulative[i]); tooltip shows standings at step i.
}
```

Notes: cumulative is monotonic non-decreasing (points only add). Position lines
cross when cumulative values swap order — that's the "cruces" the owner wants.

---

## 6. Frontend

- **New tab** "Evolución" in `PoolNav.tsx` (union + VALID_TABS + PLAYER_ITEMS) +
  render branch in `page.tsx`.
- **Chart component** (new, `components/...EvolutionChart.tsx`) using recharts
  `LineChart`:
  - Viewer line: thick, `colors.brand`, dot + pinned label at the end with final
    position (e.g. "Tú — 3°"). Other lines: thin, muted gray; podium (top 3
    final) optionally colored.
  - **Phase bands** along the X axis (Grupos · 32avos · 16avos · QF · SF · Final)
    instead of 56 individual labels (mobile-friendly).
  - **Tap/hover a step** → tooltip: the step's matches + each player's delta +
    standings at that step.
  - **Animated draw-in** (recharts `isAnimationActive` + left→right reveal).
  - Interactive legend: tap a name → highlight that player's line.
  - Mobile-first: curve fits 360px width, detail on tap, no horizontal scroll.
- **API client** `lib/api/...` `getPoolEvolution(poolId)`.
- **i18n** ES/EN/PT for tab label, tooltip strings, empty/edge states.

---

## 6b. Scalability — large pools (curated lines + pack band)

A 100-player pool = 100 lines = unreadable spaghetti + heavy payload. We never
draw more than a handful of lines, regardless of pool size:

- **Lines drawn (≤ ~12):** the viewer (always) + the **top K leaders** (global,
  e.g. 5) + the viewer's **±N neighbors** by current rank (e.g. ±3), deduped.
- **The pack:** everyone else = a shaded **min–max band per step** (optionally
  p25–p75 + median) so you see "where the bulk is" without the clutter.
  User-agnostic → precomputed in the cached bundle.
- **Search-to-add:** the viewer can add any specific player's line.
- **Tooltip unaffected:** tapping a step shows the FULL standings at that moment
  as a scrollable list, regardless of which lines are drawn.

**Payload.** Big pools: the endpoint returns only the curated lines + band
aggregates, NOT all players. Small pools (≤ `EVOLUTION_FULL_LINES`, e.g. 15) send
every line. The full per-player series stays in the cached bundle and is only
serialized for the PDF export (`?full=1`). Curation is per-viewer (cheap
selection over the cached full series); the band + leaders are user-agnostic (in
the bundle). Constants: `EVOLUTION_TOP_K`, `EVOLUTION_NEIGHBORS`,
`EVOLUTION_FULL_LINES`.

## 7. Implementation steps (no code until owner OK per step)

- [ ] **P1 — Centralize:** extract shared per-(player,match) points helper;
      leaderboard rows use it (no behavior change). tsc + suite green.
- [ ] **P2 — Series in bundle:** build evolution series in `computeLeaderboardBundle`,
      cached via ADR-079; cheap. Unit-check ordering + simultaneity + cumulative.
- [ ] **P3 — Endpoint:** `GET /pools/:poolId/evolution` (auth = pool member),
      returns the slice; `isViewer` from `req.auth.userId`.
- [ ] **P4 — Frontend tab + chart:** tab wiring + EvolutionChart (recharts),
      viewer highlight, phase bands, tap-standings, final position. i18n ×3.
- [ ] **P5 — Polish:** draw-in animation, podium colors, interactive legend,
      edge states (few steps / new member with leading zeros).
- [ ] **Test:** Polla Coronada (11 players, 56 matches), gated to owner's email
      first (allowlist pattern like ADR-081), review, then open to all.

---

## 8. Edge cases / open questions

- **Members who joined late** → leading zeros until their first scored match
  (line starts flat at 0). OK.
- **LEFT members** → keep their line (points preserved) or drop? Default: keep
  (they're in the leaderboard too).
- **Step label** for grouped simultaneous matches → date or "N partidos"? Refine
  in P4 with real data.
- **Many lines (11)** readability → viewer + podium emphasized, rest gray; tap to
  highlight. Validate on the Coronada with real curves.
- **Pool not yet started / 0 finalized matches** → empty state ("aún no hay
  partidos jugados").

---

## 9. Rollout

Gate behind an allowlist (owner email first), mirroring ADR-081, so we can review
on Polla Coronada with real data and refine before opening to all. Read-only
feature, low risk.
