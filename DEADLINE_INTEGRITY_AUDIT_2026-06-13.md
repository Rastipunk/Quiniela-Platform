# Deadline Integrity Audit — 2026-06-13

**Trigger:** user Paola (paolahass@outlook.com, "TiaPao") reported the
"Modificar predicción" button stayed active after a match's deadline.
She tried to modify and it did not work. Owner concern: can anyone
actually edit after the deadline? Is the lock per-pool/simultaneous for
all members, and enforced server-side or per-client?

**Verdict: integrity is intact. No one can modify a prediction after the
deadline.** The lingering button is a CLIENT-SIDE display staleness bug
(cosmetic), not a security hole. Every prediction-write path enforces the
deadline server-side, authoritatively, with the live clock.

---

## 1. Server-side enforcement — verified on EVERY user write path

The deadline = `match.kickoffUtc − pool.deadlineMinutesBeforeKickoff`,
computed by `computeDeadlineUtc` (pickService.ts:22-26) — **pure
arithmetic, deterministic, no per-user state**. Same lock instant for
every member of a pool. There are exactly three user-facing
prediction-write paths (enumerated by grep over `prisma.*prediction*.
(upsert|create|update)`); all three reject post-deadline writes:

| Path | Endpoint / service | Gate | Result |
|------|--------------------|------|--------|
| Match score picks | `pickService.upsertPick` | `pickService.ts:244` — `now >= deadlineUtc` → `DEADLINE_PASSED 409` (strict `>=`) | ✅ |
| Structural knockout / group picks | `routes/structuralPicks.ts` | per-unit `Date.now() >= lockTime` filter (lines 127-132 matches, 146-168 groups); locked units dropped + existing preserved verbatim; all-locked → `DEADLINE_PASSED 409` | ✅ |
| Group standings (Estratega) | `groupStandingsService.saveGroupStandingsPick` | `groupStandingsService.ts:87` — `Date.now() >= lockInfo.lockTimeMs` → `DEADLINE_PASSED 409` | ✅ |

The 4th writer, `caprichoSanService.createMany` (gift feature), is a
SYSTEM job that intentionally assigns random picks AFTER the deadline —
not a user path.

All gates read the **live `Date.now()`/`new Date()` at request time** —
NOT the stale `isLocked` boolean from the fetched payload. The host
phase-lock (`lockedPhases`) is an additional gate that takes precedence.

## 2. Per-pool, simultaneous for all members — confirmed

The lock is **per-match, derived from the pool's single
`deadlineMinutesBeforeKickoff` setting applied to each match's kickoff**.
It is NOT per-person. The same instant locks the match for every member
of the pool, computed identically server-side. What differs per person
is only the *display* (see §3), never the actual lock.

## 3. Root cause of Paola's lingering button — cosmetic client staleness

The match card's `isLocked` is computed server-side **at fetch time**
(`pickService.ts:157`, a static boolean in the overview payload). The
frontend `PickSection` gates the "Modificar" button on `!isLocked`
(`PickComponents.tsx`), and there is **no client-side live recompute for
match cards** — unlike structural picks, which use a live timer
(`useDeadlineLock` / `useDeadlinePassed`). So if a member loads the
matches list BEFORE the deadline and leaves the tab open, the cached
`isLocked=false` keeps the button visible after the deadline passes. Any
save is still rejected by the server (§1) → exactly Paola's experience
("intenté pero no funcionó").

## 4. Empirical proof (prod, read-only)

Checked all **71** of Paola's predictions in "Polla Coronada"
(deadline 10 min) — compared each `updatedAtUtc` against its match
deadline. **0 edited at/after the deadline.** Tightest margin: 236 min
BEFORE the deadline. The server gate held in practice; nothing leaked.
Probe: `c:\tmp\probe-paola-deadline.cjs`.

## 5. Recommended fix — COSMETIC only (no security impact)

Give match cards the same live client lock structural picks already have:
compute the effective lock on the client from `kickoffUtc −
deadlineMinutesBeforeKickoff` and OR it with the server `isLocked`, so
the "Modificar" button disappears the instant the deadline passes even
on a stale page. Frontend-only, low risk. Optional — the server already
guarantees integrity; this only removes the confusing button.

**Files:** `backend/src/services/pickService.ts` (computeDeadlineUtc:22,
gate:244, isLocked:157), `backend/src/routes/structuralPicks.ts`
(127-168), `backend/src/services/groupStandingsService.ts` (87),
`frontend-next/.../components/PickComponents.tsx` (button gating),
`frontend-next/src/hooks/useDeadlineLock.ts` (the live-lock pattern to reuse).
