/**
 * API-Football Client
 *
 * Cliente HTTP para interactuar con API-Football (api-sports.io)
 * Incluye rate limiting y manejo de errores
 */

import {
  ApiFootballResponse,
  ApiFootballFixture,
  ApiFootballLeague,
  ApiFootballStatus,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface ApiFootballConfig {
  apiKey: string;
  baseUrl: string;
  rateLimit: number; // requests per minute
}

function getConfig(): ApiFootballConfig {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
  const rateLimit = parseInt(process.env.API_FOOTBALL_RATE_LIMIT || '10', 10);

  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY environment variable is required');
  }

  return { apiKey, baseUrl, rateLimit };
}

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private requestTimestamps: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequestsPerMinute: number) {
    this.windowMs = 60 * 1000; // 1 minute
    this.maxRequests = maxRequestsPerMinute;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than the window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      // Wait until the oldest request is outside the window
      const oldestTimestamp = this.requestTimestamps[0];
      if (oldestTimestamp !== undefined) {
        const waitTime = this.windowMs - (now - oldestTimestamp) + 100; // +100ms buffer

        if (waitTime > 0) {
          console.log(`[API-Football] Rate limit reached. Waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    this.requestTimestamps.push(Date.now());
  }

  getRemaining(): number {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - this.requestTimestamps.length);
  }
}

// ============================================================================
// API Client
// ============================================================================

export class ApiFootballClient {
  private config: ApiFootballConfig;
  private rateLimiter: RateLimiter;

  constructor() {
    this.config = getConfig();
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
  }

  /**
   * Make a request to the API-Football API
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<ApiFootballResponse<T>> {
    await this.rateLimiter.waitIfNeeded();

    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    const startTime = Date.now();

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': this.config.apiKey,
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new ApiFootballError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          endpoint
        );
      }

      const data = (await response.json()) as ApiFootballResponse<T>;

      // Check for API-level errors
      if (data.errors && Object.keys(data.errors).length > 0) {
        const errorMessage = Array.isArray(data.errors)
          ? data.errors.join(', ')
          : Object.values(data.errors).join(', ');
        throw new ApiFootballError(`API error: ${errorMessage}`, 400, endpoint);
      }

      console.log(
        `[API-Football] ${endpoint} - ${data.results} results in ${responseTime}ms (${this.rateLimiter.getRemaining()} requests remaining)`
      );

      return data;
    } catch (error) {
      if (error instanceof ApiFootballError) {
        throw error;
      }
      throw new ApiFootballError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        endpoint
      );
    }
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Check account status and API usage
   */
  async getStatus(): Promise<ApiFootballStatus> {
    const response = await this.request<ApiFootballStatus>('/status');
    return response.response;
  }

  /**
   * Get leagues matching a search query
   */
  async getLeagues(params: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
    current?: boolean;
  } = {}): Promise<ApiFootballLeague[]> {
    const queryParams: Record<string, string | number> = {};
    if (params.id) queryParams.id = params.id;
    if (params.name) queryParams.name = params.name;
    if (params.country) queryParams.country = params.country;
    if (params.season) queryParams.season = params.season;
    if (params.current !== undefined) queryParams.current = params.current ? 'true' : 'false';

    const response = await this.request<ApiFootballLeague[]>('/leagues', queryParams);
    return response.response;
  }

  /**
   * Get fixtures (matches) with various filters
   */
  async getFixtures(params: {
    id?: number;
    ids?: string; // Comma-separated fixture IDs
    league?: number;
    season?: number;
    team?: number;
    date?: string; // YYYY-MM-DD
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
    round?: string;
    status?: string; // Comma-separated status codes
    timezone?: string;
  }): Promise<ApiFootballFixture[]> {
    const queryParams: Record<string, string | number> = {};

    if (params.id) queryParams.id = params.id;
    if (params.ids) queryParams.ids = params.ids;
    if (params.league) queryParams.league = params.league;
    if (params.season) queryParams.season = params.season;
    if (params.team) queryParams.team = params.team;
    if (params.date) queryParams.date = params.date;
    if (params.from) queryParams.from = params.from;
    if (params.to) queryParams.to = params.to;
    if (params.round) queryParams.round = params.round;
    if (params.status) queryParams.status = params.status;
    if (params.timezone) queryParams.timezone = params.timezone;

    const response = await this.request<ApiFootballFixture[]>('/fixtures', queryParams);
    return response.response;
  }

  /**
   * Get a single fixture by ID
   */
  async getFixture(fixtureId: number): Promise<ApiFootballFixture | null> {
    const fixtures = await this.getFixtures({ id: fixtureId });
    return fixtures[0] ?? null;
  }

  /**
   * Get multiple fixtures by IDs
   * Note: Free tier doesn't support bulk IDs, so we fetch one by one
   */
  async getFixturesByIds(fixtureIds: number[]): Promise<ApiFootballFixture[]> {
    if (fixtureIds.length === 0) return [];

    const results: ApiFootballFixture[] = [];

    // Fetch one by one (free tier compatible)
    // Rate limiter will handle pacing
    for (const fixtureId of fixtureIds) {
      try {
        const fixture = await this.getFixture(fixtureId);
        if (fixture) {
          results.push(fixture);
        }
      } catch (error) {
        console.error(`[API-Football] Error fetching fixture ${fixtureId}:`, error);
        // Continue with other fixtures
      }
    }

    return results;
  }

  /**
   * Get finished fixtures for a league and season
   */
  async getFinishedFixtures(leagueId: number, season: number): Promise<ApiFootballFixture[]> {
    return this.getFixtures({
      league: leagueId,
      season,
      status: 'FT-AET-PEN', // All finished statuses
    });
  }

  /**
   * Get live fixtures for a league
   */
  async getLiveFixtures(leagueId: number): Promise<ApiFootballFixture[]> {
    return this.getFixtures({
      league: leagueId,
      status: '1H-HT-2H-ET-P-BT-LIVE', // All in-progress statuses
    });
  }

  /**
   * Get fixtures that finished today for a league
   */
  async getTodayFinishedFixtures(leagueId: number, season: number): Promise<ApiFootballFixture[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return this.getFixtures({
      league: leagueId,
      season,
      date: today,
      status: 'FT-AET-PEN',
    });
  }

  /**
   * Get rate limiter remaining requests
   */
  getRateLimitRemaining(): number {
    return this.rateLimiter.getRemaining();
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'ApiFootballError';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ApiFootballClient | null = null;

/**
 * Get the API-Football client singleton
 * Returns null if API_FOOTBALL_ENABLED is not 'true'
 */
export function getApiFootballClient(): ApiFootballClient | null {
  const isEnabled = process.env.API_FOOTBALL_ENABLED === 'true';

  if (!isEnabled) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new ApiFootballClient();
  }

  return clientInstance;
}

/**
 * Check if API-Football integration is enabled
 */
export function isApiFootballEnabled(): boolean {
  return process.env.API_FOOTBALL_ENABLED === 'true';
}
