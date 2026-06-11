"use client";

// Client-side mirror of the backend lock rule for structural picks
// (ADR-070, backend/src/lib/poolHelpers.ts:buildGroupLockTimes):
// a unit locks at its earliest kickoff minus the pool's deadline
// buffer. This is UX only — the backend 409 DEADLINE_PASSED remains
// the source of truth.

import { useEffect, useState } from "react";

// setTimeout silently overflows past 2^31-1 ms (~24.8 days) — clamp.
const MAX_TIMEOUT_MS = 0x7fffffff;

const MS_PER_MINUTE = 60_000;

/**
 * Epoch ms when picks lock: earliest parseable kickoff minus the
 * deadline buffer. Infinity when no kickoff parses (never locks —
 * fail-open, matching the backend helper).
 */
export function computeLockTimeMs(
  kickoffsUtc: Array<string | undefined>,
  deadlineMinutesBeforeKickoff: number,
): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const kickoff of kickoffsUtc) {
    const ms = new Date(kickoff ?? "").getTime();
    if (!Number.isNaN(ms) && ms < earliest) earliest = ms;
  }
  if (!Number.isFinite(earliest)) return Number.POSITIVE_INFINITY;
  return earliest - deadlineMinutesBeforeKickoff * MS_PER_MINUTE;
}

/**
 * True once `lockTimeMs` passes. Schedules a re-render at the lock
 * instant so the UI freezes without a manual refresh.
 */
export function useDeadlinePassed(lockTimeMs: number): boolean {
  const [passed, setPassed] = useState(() => Date.now() >= lockTimeMs);

  useEffect(() => {
    if (Date.now() >= lockTimeMs) {
      setPassed(true);
      return;
    }
    setPassed(false);
    if (!Number.isFinite(lockTimeMs)) return;
    const delay = Math.min(lockTimeMs - Date.now(), MAX_TIMEOUT_MS);
    const id = setTimeout(() => setPassed(Date.now() >= lockTimeMs), delay);
    return () => clearTimeout(id);
  }, [lockTimeMs]);

  return passed;
}

/** Browser timezone fallback when the user has no saved preference. */
export function resolveDisplayTimezone(userTimezone: string | null | undefined): string {
  return userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
