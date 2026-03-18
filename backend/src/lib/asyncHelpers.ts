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
