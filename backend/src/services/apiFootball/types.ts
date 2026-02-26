/**
 * API-Football Types
 *
 * Tipos TypeScript para las respuestas de la API de API-Football (api-sports.io)
 * Documentación: https://www.api-football.com/documentation-v3
 */

// ============================================================================
// Response Wrapper
// ============================================================================

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T;
}

// ============================================================================
// Fixture (Match) Types
// ============================================================================

export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string; // ISO 8601: "2022-11-20T16:00:00+00:00"
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;  // "Match Finished", "Not Started", "First Half", etc.
      short: FixtureStatusShort;
      elapsed: number | null;
      extra: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string; // "Group Stage - 1", "Round of 16", "Final", etc.
    standings?: boolean;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface ApiFootballTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

// ============================================================================
// Fixture Status Codes
// ============================================================================

/**
 * Short status codes from API-Football
 *
 * Not Started:
 * - TBD: Time To Be Defined
 * - NS: Not Started
 *
 * In Play:
 * - 1H: First Half
 * - HT: Halftime
 * - 2H: Second Half
 * - ET: Extra Time
 * - P: Penalty In Progress
 * - BT: Break Time
 * - LIVE: Live (other)
 *
 * Finished:
 * - FT: Match Finished (90 min)
 * - AET: After Extra Time
 * - PEN: Finished after Penalty Shootout
 *
 * Stopped/Cancelled:
 * - PST: Postponed
 * - CANC: Cancelled
 * - ABD: Abandoned
 * - AWD: Technical Loss
 * - WO: Walkover
 * - INT: Interrupted
 * - SUSP: Suspended
 */
export type FixtureStatusShort =
  // Not Started
  | 'TBD'
  | 'NS'
  // In Play
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'P'
  | 'BT'
  | 'LIVE'
  // Finished
  | 'FT'
  | 'AET'
  | 'PEN'
  // Stopped/Cancelled
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO'
  | 'INT'
  | 'SUSP';

/**
 * Fixture statuses that indicate the match is finished
 */
export const FINISHED_STATUSES: FixtureStatusShort[] = ['FT', 'AET', 'PEN'];

/**
 * Fixture statuses that indicate the match is in progress
 */
export const IN_PROGRESS_STATUSES: FixtureStatusShort[] = ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE'];

/**
 * Fixture statuses that indicate the match hasn't started
 */
export const NOT_STARTED_STATUSES: FixtureStatusShort[] = ['TBD', 'NS'];

/**
 * Fixture statuses that indicate the match was cancelled/stopped
 */
export const CANCELLED_STATUSES: FixtureStatusShort[] = ['PST', 'CANC', 'ABD', 'AWD', 'WO', 'INT', 'SUSP'];

// ============================================================================
// League Types
// ============================================================================

export interface ApiFootballLeague {
  league: {
    id: number;
    name: string;
    type: 'League' | 'Cup';
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: ApiFootballSeason[];
}

export interface ApiFootballSeason {
  year: number;
  start: string; // "2026-06-11"
  end: string;   // "2026-07-19"
  current: boolean;
  coverage: {
    fixtures: {
      events: boolean;
      lineups: boolean;
      statistics_fixtures: boolean;
      statistics_players: boolean;
    };
    standings: boolean;
    players: boolean;
    top_scorers: boolean;
    top_assists: boolean;
    top_cards: boolean;
    injuries: boolean;
    predictions: boolean;
    odds: boolean;
  };
}

// ============================================================================
// Account Status Types
// ============================================================================

export interface ApiFootballStatus {
  account: {
    firstname: string;
    lastname: string;
    email: string;
  };
  subscription: {
    plan: string;
    end: string; // ISO date
    active: boolean;
  };
  requests: {
    current: number;
    limit_day: number;
  };
}

// ============================================================================
// Helper Types for Our Application
// ============================================================================

/**
 * Parsed result from an API-Football fixture
 * Used by our sync service
 */
export interface ParsedFixtureResult {
  fixtureId: number;
  status: FixtureStatusShort;
  isFinished: boolean;
  homeGoals: number;
  awayGoals: number;
  fulltimeHome: number | null;  // Score at 90 minutes (from score.fulltime)
  fulltimeAway: number | null;
  halftimeHome: number | null;
  halftimeAway: number | null;
  extratimeHome: number | null;
  extratimeAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  homeTeamId: number;
  awayTeamId: number;
  kickoffUtc: string;
  round: string;
}

/**
 * Check if a fixture status indicates the match is finished
 */
export function isFixtureFinished(status: FixtureStatusShort): boolean {
  return FINISHED_STATUSES.includes(status);
}

/**
 * Check if a fixture status indicates the match is in progress
 */
export function isFixtureInProgress(status: FixtureStatusShort): boolean {
  return IN_PROGRESS_STATUSES.includes(status);
}

/**
 * Parse an API-Football fixture into our simplified result format
 */
export function parseFixtureResult(fixture: ApiFootballFixture): ParsedFixtureResult | null {
  const status = fixture.fixture.status.short;
  const isFinished = isFixtureFinished(status);

  // If not finished and goals are null, return null
  if (!isFinished && fixture.goals.home === null) {
    return null;
  }

  return {
    fixtureId: fixture.fixture.id,
    status,
    isFinished,
    homeGoals: fixture.goals.home ?? 0,
    awayGoals: fixture.goals.away ?? 0,
    fulltimeHome: fixture.score.fulltime.home,
    fulltimeAway: fixture.score.fulltime.away,
    halftimeHome: fixture.score.halftime.home,
    halftimeAway: fixture.score.halftime.away,
    extratimeHome: fixture.score.extratime.home,
    extratimeAway: fixture.score.extratime.away,
    penaltyHome: fixture.score.penalty.home,
    penaltyAway: fixture.score.penalty.away,
    homeTeamId: fixture.teams.home.id,
    awayTeamId: fixture.teams.away.id,
    kickoffUtc: fixture.fixture.date,
    round: fixture.league.round,
  };
}
