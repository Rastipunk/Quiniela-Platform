/**
 * Typed interfaces for the PoolOverview API response.
 *
 * Source of truth: backend GET /pools/:poolId/overview (pools.ts:681-759)
 *
 * These types replace `export type PoolOverview = any` and eliminate
 * the cascade of `as any` casts throughout the pool page components.
 */

// ─── Sub-types ───────────────────────────────────────────────

export interface PoolOrganization {
  id: string;
  name: string;
  logoBase64: string | null;
  welcomeMessage: string | null;
}

export interface PoolInfo {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  status: string;
  timeZone: string;
  deadlineMinutesBeforeKickoff: number;
  tournamentInstanceId: string;
  createdByUserId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  scoringPresetKey: string;
  pickTypesConfig: PhasePickConfigItem[] | null;
  autoAdvanceEnabled: boolean;
  requireApproval: boolean;
  maxParticipants: number | null;
  lockedPhases: string[];
  organizationId: string | null;
  organization: PoolOrganization | null;
}

export interface PoolMembership {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAtUtc: string;
}

export interface PoolCounts {
  membersActive: number;
}

export interface PoolTournamentInstance {
  id: string;
  name: string;
  status: string;
  templateId: string;
  templateVersionId: string;
  templateKey: string | null;
  dataJson: PoolFixtureData;
}

export interface PoolFixtureData {
  meta?: { name?: string; competition?: string; seasonYear?: number; sport?: string };
  teams: PoolFixtureTeam[];
  phases: PoolFixturePhase[];
  matches: PoolFixtureMatch[];
  advancement?: unknown;
  note?: string;
}

export interface PoolFixtureTeam {
  id: string;
  name?: string;
  shortName?: string;
  code?: string;
  groupId?: string;
}

export interface PoolFixturePhase {
  id: string;
  name: string;
  type: string;
  order: number;
  twoLegged?: boolean;
  legNumber?: number;
  config?: Record<string, unknown>;
}

export interface PoolFixtureMatch {
  id: string;
  phaseId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  matchNumber?: number;
  roundLabel?: string;
  label?: string;
  venue?: string;
  groupId?: string;
}

export interface PoolPermissions {
  canManageResults: boolean;
  canInvite: boolean;
}

export interface PoolTeamRef {
  id: string;
  name: string | null;
  code: string | null;
}

export interface PoolMatchPick {
  type: string;
  homeGoals?: number;
  awayGoals?: number;
  outcome?: string;
}

export interface PoolMatchResult {
  homeGoals: number;
  awayGoals: number;
  homeGoals90?: number | null;
  awayGoals90?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  version: number;
  reason?: string | null;
}

export interface PoolMatchCard {
  id: string;
  phaseId: string;
  kickoffUtc: string;
  deadlineUtc: string;
  isLocked: boolean;
  matchNumber: number | null;
  roundLabel: string | null;
  label: string | null;
  venue: string | null;
  groupId: string | null;
  homeTeam: PoolTeamRef;
  awayTeam: PoolTeamRef;
  myPick: PoolMatchPick | null;
  result: PoolMatchResult | null;
  scoringEnabled: boolean;
  scoringOverrideReason: string | null;
}

export interface ScoringConfig {
  outcomePoints: number;
  exactScoreBonus: number;
}

export interface ScoringPreset {
  key: string;
  name: string;
  description: string;
  allowScorePick: boolean;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  memberId: string;
  displayName: string;
  role: string;
  memberStatus: string;
  points: number;
  pointsByPhase: Record<string, number>;
  scoredMatches: number;
  joinedAtUtc: string;
  breakdown?: unknown[];
}

export interface PoolLeaderboard {
  scoring: ScoringConfig;
  scoringPreset: ScoringPreset;
  verbose: boolean;
  phases: string[];
  rows: LeaderboardRow[];
}

/** Phase pick config item (matches backend PhasePickConfig) */
export interface PhasePickConfigItem {
  phaseId: string;
  requiresScore: boolean;
  includeExtraTime?: boolean;
  structuralPicks?: {
    type: string;
    config: Record<string, unknown>;
  } | null;
}

// ─── Main type ───────────────────────────────────────────────

export interface PoolOverview {
  nowUtc: string;
  pool: PoolInfo;
  myMembership: PoolMembership;
  counts: PoolCounts;
  tournamentInstance: PoolTournamentInstance;
  permissions: PoolPermissions;
  matches: PoolMatchCard[];
  leaderboard: PoolLeaderboard;
}
