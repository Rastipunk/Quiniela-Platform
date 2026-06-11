/**
 * Shared async utilities.
 */

/**
 * Execute a promise without awaiting it, logging any errors.
 * Used for fire-and-forget side effects (audit events, emails, notifications).
 */
export function fireAndForget(label: string, promise: Promise<unknown>): void {
  promise.catch((err) => {
    console.error(`[${label}] failed:`, err instanceof Error ? err.message : String(err));
  });
}

/**
 * Minimal promise-pool: returns a runner that executes at most `max`
 * callbacks in flight at a time; the rest queue in FIFO order. Use it
 * to bound bursts of database work — e.g. the admin analytics dashboard
 * fires 26 independent query bundles, and running them unbounded opened
 * more Postgres connections than max_connections allows.
 */
export function createLimiter(max: number) {
  let active = 0;
  const waiters: Array<() => void> = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiters.shift()?.();
    }
  };
}
