/**
 * Synthetic fixture ID generator for matches not sourced from API-Football.
 *
 * Range 900000–999999 avoids collision with real API-Football IDs
 * (World Cup 2026 range is ~1,400,000–1,600,000). Deterministic on
 * (instanceId, internalMatchId) so re-running advancement is idempotent.
 */
export function generateSyntheticFixtureId(instanceId: string, internalMatchId: string): number {
  const hash = djb2(`${instanceId}:${internalMatchId}`);
  return 900000 + (Math.abs(hash) % 99999);
}

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h | 0; // force int32
  }
  return h;
}
