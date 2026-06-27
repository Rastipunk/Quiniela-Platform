import crypto from "crypto";
import { CRYPTO_BYTES } from "./constants";
import { isMatchBasedScoring } from "./scoringAdvanced";
import type { PhasePickConfig } from "../types/pickConfig";
import type { FixtureMatch } from "./fixture";

export function outcomeFromScore(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

/**
 * Builds a predicate answering "does this phase take per-match score
 * picks (Prediction rows)?" from a pool's raw `pickTypesConfig` JSON.
 *
 * Structural phases (GROUP_STANDINGS / KNOCKOUT_WINNER — Estratega)
 * never have Prediction rows, so any code that counts "matches without
 * a pick" (notifications, deadline reminder emails) MUST filter through
 * this predicate or it will report missing picks that cannot exist.
 *
 * Fallback rules (deliberately conservative — preserve legacy counting):
 * - Pool without `pickTypesConfig` (predates advanced picks): every
 *   phase counts as match-based.
 * - Match without a `phaseId` (legacy fixture shape): counts as
 *   match-based, since it cannot be classified.
 */
export function buildPhaseTakesMatchPicks(
  pickTypesConfigJson: unknown,
): (phaseId: string | undefined) => boolean {
  const config = Array.isArray(pickTypesConfigJson)
    ? (pickTypesConfigJson as PhasePickConfig[])
    : [];
  const matchPickPhaseIds = new Set(
    config.filter(isMatchBasedScoring).map((pc) => pc.phaseId),
  );
  return (phaseId: string | undefined): boolean => {
    if (config.length === 0) return true;
    if (!phaseId) return true;
    return matchPickPhaseIds.has(phaseId);
  };
}

/**
 * A match is "floor-locked" when the host REDUCED the prediction deadline after
 * this match's predictions were already revealed (ADR-085 anti-cheat ratchet).
 * `Pool.predictionLockFloorUtc` is the kickoff high-water mark: any match
 * kicking off at/before it stays locked even if the new deadline would reopen it.
 * Treated identically to "deadline already passed" everywhere it is checked.
 */
export function isKickoffFloorLocked(
  kickoffUtc: string | null | undefined,
  lockFloorUtc: Date | string | null | undefined,
): boolean {
  if (!lockFloorUtc || !kickoffUtc) return false;
  const k = new Date(kickoffUtc).getTime();
  const f = new Date(lockFloorUtc).getTime();
  return !Number.isNaN(k) && !Number.isNaN(f) && k <= f;
}

export interface GroupLockInfo {
  /**
   * Epoch ms after which the group's standings pick is locked.
   * `Infinity` when the group has matches but none with a parseable
   * kickoff — such a group can never lock (fail-open, matching the
   * behavior of match-based deadlines on malformed fixtures).
   */
  lockTimeMs: number;
  /** ISO kickoff of the group's earliest match; null when unparseable. */
  firstKickoffUtc: string | null;
}

/**
 * Computes the lock time of every group in a fixture: the group's
 * earliest kickoff minus the pool's deadline buffer. A group-standings
 * prediction locks at that instant because the first result starts
 * revealing the real table (single source of this rule — used by the
 * dedicated group-standings endpoint, the generic structural-picks
 * endpoint, notifications, and deadline reminders).
 */
export function buildGroupLockTimes(
  matches: Array<Pick<FixtureMatch, "groupId" | "kickoffUtc">>,
  deadlineMinutesBeforeKickoff: number,
  /** ADR-085 ratchet: a group whose earliest kickoff is at/before this stays
   *  permanently locked (its standings were already revealed). */
  lockFloorUtc?: Date | string | null,
): Map<string, GroupLockInfo> {
  const earliestByGroup = new Map<string, number>();
  const groupsSeen = new Set<string>();
  for (const m of matches) {
    if (!m.groupId) continue;
    groupsSeen.add(m.groupId);
    const kickoffMs = new Date(m.kickoffUtc ?? "").getTime();
    if (Number.isNaN(kickoffMs)) continue;
    const prev = earliestByGroup.get(m.groupId);
    if (prev === undefined || kickoffMs < prev) {
      earliestByGroup.set(m.groupId, kickoffMs);
    }
  }
  const bufferMs = deadlineMinutesBeforeKickoff * 60_000;
  const floorMs = lockFloorUtc ? new Date(lockFloorUtc).getTime() : NaN;
  const lockTimes = new Map<string, GroupLockInfo>();
  for (const groupId of groupsSeen) {
    const earliest = earliestByGroup.get(groupId);
    if (earliest === undefined) {
      lockTimes.set(groupId, { lockTimeMs: Number.POSITIVE_INFINITY, firstKickoffUtc: null });
      continue;
    }
    // Floored group → already revealed → permanently locked.
    const floored = !Number.isNaN(floorMs) && earliest <= floorMs;
    lockTimes.set(groupId, {
      lockTimeMs: floored ? Number.NEGATIVE_INFINITY : earliest - bufferMs,
      firstKickoffUtc: new Date(earliest).toISOString(),
    });
  }
  return lockTimes;
}

export interface GroupPick {
  groupId: string;
  teamIds: string[];
}

/**
 * Splits incoming group-standings picks into saveable vs locked.
 * A pick is locked when its group's lock time has passed — or when the
 * groupId is unknown to the fixture (stale UI / forged payload), the
 * same drop rule the knockout path applies to unknown matchIds.
 */
export function partitionGroupPicksByLock(
  incoming: GroupPick[],
  lockTimes: Map<string, GroupLockInfo>,
  nowMs: number,
): { valid: GroupPick[]; lockedGroupIds: string[] } {
  const valid: GroupPick[] = [];
  const lockedGroupIds: string[] = [];
  for (const pick of incoming) {
    const lock = lockTimes.get(pick.groupId);
    if (!lock || nowMs >= lock.lockTimeMs) {
      lockedGroupIds.push(pick.groupId);
      continue;
    }
    valid.push(pick);
  }
  return { valid, lockedGroupIds };
}

/**
 * Merges saveable incoming group picks over the existing ones so picks
 * for already-locked groups are preserved verbatim — a full replace
 * would let a client erase a locked group's pick after kickoff.
 */
export function mergeGroupPicks(
  existing: GroupPick[] | undefined,
  incoming: GroupPick[],
): GroupPick[] {
  const byGroupId = new Map<string, string[]>();
  for (const g of existing ?? []) byGroupId.set(g.groupId, g.teamIds);
  for (const g of incoming) byGroupId.set(g.groupId, g.teamIds);
  return Array.from(byGroupId.entries()).map(([groupId, teamIds]) => ({
    groupId,
    teamIds,
  }));
}

export function makeInviteCode() {
  // Comentario en español: código corto, suficientemente único para MVP
  return crypto.randomBytes(CRYPTO_BYTES.POOL_INVITE_CODE).toString("hex"); // 12 chars
}
