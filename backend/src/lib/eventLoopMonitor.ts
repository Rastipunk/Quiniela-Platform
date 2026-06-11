/**
 * Event-loop lag monitor — exposes a p99 over the last 30 s.
 *
 * Node's monitorEventLoopDelay() is sampled every `resolution` ms by
 * libuv and produces a histogram; we reset it every 30 s so the p99 we
 * read always reflects recent state, not the lifetime of the process.
 * A sustained high p99 is the canonical "the backend is CPU-saturated"
 * signal — far more sensitive than RSS, because a synchronous loop
 * that blocks 500 ms gives the user a real 500 ms response delay even
 * if memory looks fine.
 */

import { monitorEventLoopDelay, IntervalHistogram } from "perf_hooks";

let histogram: IntervalHistogram | null = null;
let lastReset = 0;

const RESET_INTERVAL_MS = 30_000;

export function startEventLoopMonitor(): void {
  if (histogram) return; // already started
  histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  lastReset = Date.now();
}

/** Returns the current 30 s window's p99 lag in milliseconds. */
export function getEventLoopP99Ms(): number {
  if (!histogram) return 0;
  const now = Date.now();
  // Read p99 first so we don't lose data; THEN roll the window if
  // we're past the reset interval. p99 returns nanoseconds.
  const p99Ns = histogram.percentile(99);
  if (now - lastReset >= RESET_INTERVAL_MS) {
    histogram.reset();
    lastReset = now;
  }
  return p99Ns / 1_000_000;
}

export function stopEventLoopMonitor(): void {
  if (!histogram) return;
  histogram.disable();
  histogram = null;
}
