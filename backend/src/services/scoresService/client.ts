/**
 * Scores Service Client
 *
 * HTTP client for the picks4all-scores scraping service.
 * Communicates via REST API with Bearer token auth.
 */

// ============================================================================
// Configuration (env vars with defaults)
// ============================================================================

const envStr = (key: string, fallback: string): string =>
  process.env[key] || fallback;

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const SCORES_SERVICE_URL = (): string => envStr("SCORES_SERVICE_URL", "");
const SCORES_SERVICE_API_KEY = (): string => envStr("SCORES_SERVICE_API_KEY", "");
const TIMEOUT_MS = (): number => envInt("SCORES_SERVICE_TIMEOUT_MS", 10000);

// ============================================================================
// Types
// ============================================================================

export interface LiveScore {
  apiFootballFixtureId: number;
  homeGoals: number;
  awayGoals: number;
  halftimeHome: number | null;
  halftimeAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
  extratimeHome: number | null;
  extratimeAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  status: string; // MatchStatus codes: 1H, HT, 2H, ET, P, FT, AET, PEN, etc.
  elapsed: number | null;
  extra: number | null;
  confidence: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  sourcesAgreeing: number;
  sourcesTotal: number;
  lastUpdated: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Kickoff observed by sources (median if multiple report it).
   *  Falls back to registered kickoff if no source reported. */
  actualKickoffUtc?: string;
}

export interface LiveScoresResponse {
  matches: LiveScore[];
  scrapedAt: string;
  activeSources: number;
  totalSources: number;
}

export interface TrackFixture {
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: number;
  awayTeamId: number;
  kickoffUtc: string;
  /** API-Football league ID — required for /fixtures/verify support */
  leagueId?: number;
  /** Season year — required for /fixtures/verify support */
  season?: number;
}

export type TrackFixtureStatus = "TRACKING" | "ALREADY_TRACKING" | "REJECTED";

export interface TrackFixtureDetail {
  fixtureId: number;
  status: TrackFixtureStatus;
  scrapingSources?: string[];
  expectedFirstScrapeAt?: string;
  reason?: string;
}

export interface TrackResponse {
  tracked: number;
  alreadyTracking: number;
  rejected: number;
  total: number;
  message: string;
  details: TrackFixtureDetail[];
}

export interface FixturesVerifyFixture {
  fixtureId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: number;
  awayTeamId: number;
  /** Observed kickoff (consensus from sources, fallback to registered) */
  kickoffUtc: string;
  /** Original kickoff sent in POST /track */
  registeredKickoffUtc: string;
  status: string;
  venue: string | null;
  round: string | null;
  sourcesAgreeing: number;
  sourcesTotal: number;
}

export interface FixturesVerifyResponse {
  league: number;
  season: number;
  scrapedAt: string;
  fixtures: FixturesVerifyFixture[];
}

export interface TrackStatusEntry {
  fixtureId: number;
  status: "TRACKING";
  addedAt: string;
  lastScrapedAt: string | null;
  sources: string[];
  currentMatchStatus: string | null;
}

export interface TrackStatusResponse {
  tracked: TrackStatusEntry[];
  untracked: number[];
}

interface HealthResponse {
  status: string;
  uptime?: number;
  version?: string;
}

// ============================================================================
// Client
// ============================================================================

export class ScoresServiceClient {
  /**
   * Check if the service URL and API key are configured.
   */
  isAvailable(): boolean {
    return Boolean(SCORES_SERVICE_URL()) && Boolean(SCORES_SERVICE_API_KEY());
  }

  /**
   * GET /api/v1/scores/live — fetch current live scores.
   */
  async getLiveScores(): Promise<LiveScoresResponse> {
    const data = await this.request<LiveScoresResponse>(
      "GET",
      "/api/v1/scores/live"
    );
    return data;
  }

  /**
   * POST /api/v1/track — register fixtures for tracking.
   */
  async trackFixtures(fixtures: TrackFixture[]): Promise<TrackResponse> {
    const data = await this.request<TrackResponse>(
      "POST",
      "/api/v1/track",
      { fixtures }
    );
    return data;
  }

  /**
   * GET /api/v1/fixtures/verify — fetch verified fixtures for a league/season.
   * Used by the daily verification job to detect kickoff drift.
   */
  async getFixturesVerify(params: {
    league: number;
    season: number;
    since?: string;
    until?: string;
  }): Promise<FixturesVerifyResponse> {
    const qs = new URLSearchParams({
      league: String(params.league),
      season: String(params.season),
    });
    if (params.since) qs.append("since", params.since);
    if (params.until) qs.append("until", params.until);
    const data = await this.request<FixturesVerifyResponse>(
      "GET",
      `/api/v1/fixtures/verify?${qs.toString()}`
    );
    return data;
  }

  /**
   * GET /api/v1/track/status — check if specific fixtures are being tracked.
   * Used for pre-match health checks.
   */
  async getTrackStatus(fixtureIds: number[]): Promise<TrackStatusResponse> {
    if (fixtureIds.length === 0) {
      return { tracked: [], untracked: [] };
    }
    const qs = new URLSearchParams({ fixtureIds: fixtureIds.join(",") });
    const data = await this.request<TrackStatusResponse>(
      "GET",
      `/api/v1/track/status?${qs.toString()}`
    );
    return data;
  }

  /**
   * GET /health — check service health.
   */
  async getHealth(): Promise<HealthResponse> {
    const data = await this.request<HealthResponse>("GET", "/health");
    return data;
  }

  // --------------------------------------------------------------------------
  // Internal HTTP helper
  // --------------------------------------------------------------------------

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${SCORES_SERVICE_URL()}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS());

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${SCORES_SERVICE_API_KEY()}`,
        Accept: "application/json",
      };

      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }

      const res = await fetch(url, init);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `[ScoresService] ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`
        );
      }

      const data = (await res.json()) as T;
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `[ScoresService] ${method} ${path} timed out after ${TIMEOUT_MS()}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _instance: ScoresServiceClient | null = null;

export function getScoresServiceClient(): ScoresServiceClient {
  if (!_instance) {
    _instance = new ScoresServiceClient();
  }
  return _instance;
}

export function isScoresServiceConfigured(): boolean {
  return getScoresServiceClient().isAvailable();
}
