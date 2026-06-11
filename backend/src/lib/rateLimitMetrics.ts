/**
 * Sliding-minute counter of express-rate-limit 429 emissions, used by
 * the platform-health monitor. Tracking it in memory is fine: a backend
 * restart drops the counter, which is the same behavior the health
 * monitor wants ("show me 429s since this process started staying up").
 *
 * Bucket layout: a fixed-size ring of per-second slots. recordHit()
 * is O(1) writes, lastMinuteCount() is O(60). No timers.
 */

const BUCKET_SIZE = 60; // 60 one-second buckets = one rolling minute
const buckets: number[] = new Array(BUCKET_SIZE).fill(0);
let lastBucketEpochSec = 0;

function currentBucketIdx(epochSec: number): number {
  return epochSec % BUCKET_SIZE;
}

function rollWindow(nowSec: number): void {
  if (lastBucketEpochSec === 0) {
    lastBucketEpochSec = nowSec;
    return;
  }
  // Zero out buckets between lastBucketEpochSec+1 and nowSec inclusive
  // (capped at BUCKET_SIZE — anything older is already overwritten).
  const span = Math.min(nowSec - lastBucketEpochSec, BUCKET_SIZE);
  for (let i = 1; i <= span; i++) {
    buckets[currentBucketIdx(lastBucketEpochSec + i)] = 0;
  }
  lastBucketEpochSec = nowSec;
}

export function recordRateLimitHit(): void {
  const nowSec = Math.floor(Date.now() / 1000);
  rollWindow(nowSec);
  const idx = currentBucketIdx(nowSec);
  buckets[idx] = (buckets[idx] ?? 0) + 1;
}

export function lastMinuteRateLimitHits(): number {
  const nowSec = Math.floor(Date.now() / 1000);
  rollWindow(nowSec);
  let sum = 0;
  for (const b of buckets) sum += b;
  return sum;
}
