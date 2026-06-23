/**
 * Pool Leaderboard Cache — short-lived, per-pool cache for the EXPENSIVE
 * leaderboard computation of the pool overview (ADR-079).
 *
 * Why: `GET /pools/:id/overview` recomputed the full leaderboard (load every
 * member's predictions + an O(members × matches) scoring loop) on EVERY
 * request. On large pools that was 2–55 s of synchronous work that blocked
 * Node's single event loop and slowed the whole platform. The leaderboard is
 * identical for every user of a pool, so it is computed once and shared.
 *
 * Correctness model (the leaderboard only changes when the *match inputs*
 * change — results, membership, picks, scoring overrides):
 *   - The caller passes a cheap `fingerprint` built from those inputs. A
 *     cached entry is served only when its fingerprint matches AND it is
 *     within the max-age safety net. Any relevant change ⇒ fingerprint
 *     differs ⇒ recompute. So a freshly published result is reflected on the
 *     very next request — no waiting for a TTL.
 *   - The max-age (TTL) is a pure safety net for the rare input a fingerprint
 *     might not capture (e.g. a scoring-override toggle that nets a zero
 *     count change). It self-heals within the window.
 *
 * This is a READ-ONLY derived cache. It NEVER writes to the database, so it
 * can never lose or corrupt data. If anything looks wrong, set the TTL env
 * var to 0 to disable it entirely (behaviour reverts to recompute-every-time,
 * exactly as before) — instant, no deploy.
 */

// Max age of a cached entry, ms. 0 (or negative) ⇒ cache disabled (kill-switch).
// Read per-call so the kill-switch is honoured without a code change.
function ttlMs(): number {
  return parseInt(process.env.POOL_LEADERBOARD_CACHE_TTL_MS || "20000", 10);
}
// Hard cap on cached pools to bound memory (eviction is insertion-order).
function maxEntries(): number {
  return parseInt(process.env.POOL_LEADERBOARD_CACHE_MAX || "1000", 10);
}

type Entry = { fingerprint: string; bundle: unknown; ts: number };

const cache = new Map<string, Entry>();
// Coalesce concurrent misses for the same pool onto a single computation so a
// refresh storm (everyone reloading during a live match) computes once.
const inFlight = new Map<string, Promise<unknown>>();

let hits = 0;
let misses = 0;
let lastStatsLogAt = 0;
const STATS_LOG_EVERY_MS = 60_000;

function maybeLogStats(): void {
  const now = Date.now();
  if (now - lastStatsLogAt < STATS_LOG_EVERY_MS) return;
  lastStatsLogAt = now;
  const total = hits + misses;
  if (total === 0) return;
  const rate = ((hits / total) * 100).toFixed(1);
  console.log(
    `[leaderboard cache] hits=${hits} misses=${misses} hitRate=${rate}% entries=${cache.size}`,
  );
}

function store(poolId: string, entry: Entry): void {
  cache.set(poolId, entry);
  if (cache.size > maxEntries()) {
    // Map preserves insertion order — drop the oldest entry that isn't the
    // one we just wrote.
    for (const key of cache.keys()) {
      if (key !== poolId) {
        cache.delete(key);
        break;
      }
    }
  }
}

/**
 * Return the cached leaderboard bundle for `poolId` if its fingerprint still
 * matches and it is within the max-age; otherwise compute it (coalescing
 * concurrent misses), cache it, and return it.
 *
 * With TTL_MS <= 0 the cache is bypassed entirely and `compute()` runs every
 * time — identical to the pre-cache behaviour.
 */
export async function getOrComputeLeaderboard<T>(
  poolId: string,
  fingerprint: string,
  compute: () => Promise<T>,
): Promise<T> {
  const ttl = ttlMs();
  if (ttl <= 0) return compute(); // kill-switch

  const now = Date.now();
  const cached = cache.get(poolId);
  if (cached && cached.fingerprint === fingerprint && now - cached.ts < ttl) {
    hits++;
    maybeLogStats();
    return cached.bundle as T;
  }

  // Join an in-flight computation for the same pool (refresh-storm safety).
  const pending = inFlight.get(poolId);
  if (pending) return pending as Promise<T>;

  misses++;
  maybeLogStats();
  const promise = (async () => {
    const bundle = await compute();
    store(poolId, { fingerprint, bundle, ts: Date.now() });
    return bundle;
  })().finally(() => {
    inFlight.delete(poolId);
  });
  inFlight.set(poolId, promise);
  return promise as Promise<T>;
}

/** Drop a pool's cached leaderboard (defensive; the fingerprint already
 *  forces a recompute on the next request when inputs change). */
export function invalidatePoolLeaderboard(poolId: string): void {
  cache.delete(poolId);
}
