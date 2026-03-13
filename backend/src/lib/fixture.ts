/**
 * Centralized fixture data types and extraction utilities.
 *
 * Prisma stores fixture data as `Json` (opaque). This module provides
 * typed interfaces and safe extractors so that route files never need
 * `as any` casts when reading fixture/tournament data.
 *
 * The canonical Zod schema lives in `schemas/templateData.ts` and is
 * used for *validation on write*. The types here are for *read access*
 * and include optional UCL-specific extensions (tieNumber, leg, etc.).
 */

// ─── Core Fixture Types ───────────────────────────────────────

export interface FixtureTeam {
  id: string;
  name?: string;
  shortName?: string;
  code?: string;
  groupId?: string;
}

export interface FixturePhase {
  id: string;
  name: string;
  type: string;           // "GROUP" | "KNOCKOUT" | "KNOCKOUT_LEG" | "KNOCKOUT_FINAL"
  order: number;
  twoLegged?: boolean;    // UCL: whether this phase has two legs
  legNumber?: number;     // UCL: which leg (1 or 2)
  config?: {
    groupsCount?: number;
    teamsPerGroup?: number;
    legs?: number;
  };
}

export interface FixtureMatch {
  id: string;
  phaseId: string;
  kickoffUtc: string;       // ISO 8601
  homeTeamId: string;
  awayTeamId: string;
  matchNumber?: number;
  roundLabel?: string;
  label?: string;           // UCL: human-readable label e.g. "Arsenal vs Bayern"
  venue?: string;
  groupId?: string;
  tieNumber?: number;       // UCL: tie identifier
  leg?: number;             // UCL: leg 1 or 2
  status?: string;          // UCL: "SCHEDULED" | "PLACEHOLDER"
}

export interface FixtureMeta {
  name?: string;
  competition?: string;
  seasonYear?: number;
  sport?: "football";
}

export interface FixtureData {
  meta?: FixtureMeta;
  teams: FixtureTeam[];
  phases: FixturePhase[];
  matches: FixtureMatch[];
  advancement?: unknown;    // UCL-specific advancement config
  note?: string;
}

// ─── Safe Extractors ──────────────────────────────────────────

/**
 * Safely parses an opaque Prisma Json value into typed FixtureData.
 * Returns a default empty structure if the input is null/undefined/malformed.
 */
export function parseFixtureData(dataJson: unknown): FixtureData {
  if (!dataJson || typeof dataJson !== "object") {
    return { teams: [], phases: [], matches: [] };
  }
  const dj = dataJson as Record<string, unknown>;
  return {
    meta: (dj.meta as FixtureMeta) ?? undefined,
    teams: Array.isArray(dj.teams) ? (dj.teams as FixtureTeam[]) : [],
    phases: Array.isArray(dj.phases) ? (dj.phases as FixturePhase[]) : [],
    matches: Array.isArray(dj.matches) ? (dj.matches as FixtureMatch[]) : [],
    advancement: dj.advancement ?? undefined,
    note: typeof dj.note === "string" ? dj.note : undefined,
  };
}

/** Extract only matches from opaque fixture data. */
export function extractMatches(dataJson: unknown): FixtureMatch[] {
  return parseFixtureData(dataJson).matches;
}

/** Extract only teams from opaque fixture data. */
export function extractTeams(dataJson: unknown): FixtureTeam[] {
  return parseFixtureData(dataJson).teams;
}

/** Extract only phases from opaque fixture data. */
export function extractPhases(dataJson: unknown): FixturePhase[] {
  return parseFixtureData(dataJson).phases;
}
