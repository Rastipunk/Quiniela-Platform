/**
 * Welcome email fallback job.
 *
 * Catches users who never reach LocalePreferenceModal completion (closed
 * the tab, never logged back in, etc.) and ships their welcome 24h
 * after account creation. Without this job, every commit-3 deferral
 * silently dropped welcomes for users who don't navigate to the
 * dashboard.
 *
 * Locale resolution per CORPORATE_LOCALE_HANDOFF_AUDIT.md §3.2:
 *   - Corporate path (user is a member of a pool with an
 *     Organization): use that org.invitationLocale.
 *   - Otherwise (signup path): use resolveUserLocale (User.country
 *     and platform default fallback).
 *
 * Idempotent via User.welcomeEmailSentAt: once set, the row is no
 * longer in the candidate set. No retry counter — a Resend failure
 * means the row stays NULL and the next tick retries.
 *
 * Multi-instance safety: Postgres advisory lock keyed to 82636505n
 * (distinct from CC expiry sweep at 82636504n) so the two jobs run
 * in parallel without contention.
 */

import * as cron from "node-cron";
import { prisma } from "../db";
import { sendWelcomeEmail } from "../lib/email";
import { resolveUserLocale } from "../lib/constants";

// Run at :15 past every hour so the tick doesn't pile on the hour
// mark with other cron jobs.
const FALLBACK_CRON = process.env.WELCOME_FALLBACK_CRON || "15 * * * *";

// Threshold: a user must be older than this before the fallback
// fires. 24h is the locked decision in AUDIT §3.2.
const FALLBACK_HOURS = Number(process.env.WELCOME_FALLBACK_HOURS || "24");

// Cap per tick. Even in a launch wave this is plenty — the realistic
// daily volume of "users who activated but never opened the dashboard"
// is single-digit.
const BATCH_SIZE = Number(process.env.WELCOME_FALLBACK_BATCH || "50");

// Distinct from paymentReconcileJob (82636503n), capiRetryJob
// (82636502n), and accountReceivableExpiryJob (82636504n) so all
// four jobs can run concurrently on the same replica.
const ADVISORY_LOCK_KEY = 82636505n;

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

async function runWithClusterLock(action: () => Promise<void>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint) AS locked`,
    );
    if (!rows[0]?.locked) return;
    await action();
  });
}

async function runOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    await runWithClusterLock(async () => {
      const cutoff = new Date(Date.now() - FALLBACK_HOURS * 3600_000);

      // Pull candidates with the org-membership info we need to
      // resolve the locale. `poolMemberships` is filtered to only the
      // ones in a corporate pool — standard memberships are ignored
      // for locale resolution (resolveUserLocale handles those).
      const candidates = await prisma.user.findMany({
        where: {
          welcomeEmailSentAt: null,
          createdAtUtc: { lt: cutoff },
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          locale: true,
          country: true,
          poolMemberships: {
            where: { pool: { organizationId: { not: null } } },
            take: 1,
            select: {
              pool: {
                select: {
                  organization: { select: { invitationLocale: true } },
                },
              },
            },
          },
        },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) return;

      console.log(`[WelcomeFallback] Found ${candidates.length} user(s) to welcome`);

      let sent = 0;
      let failed = 0;
      for (const user of candidates) {
        const orgLocale = user.poolMemberships[0]?.pool.organization?.invitationLocale;
        const locale = (orgLocale as "es" | "en" | "pt" | undefined) ?? resolveUserLocale(user);

        try {
          const result = await sendWelcomeEmail({
            to: user.email,
            userId: user.id,
            displayName: user.displayName,
            locale,
          });
          // Mark sent regardless of result.success — Resend's success
          // flag is a delivery hint, not a delivery guarantee. If we
          // discover real undeliverable cases we can flip to
          // retry-on-error later (would need a retry counter to avoid
          // loops). v1 chooses simplicity.
          await prisma.user.update({
            where: { id: user.id },
            data: { welcomeEmailSentAt: new Date() },
          });
          if (result.success) sent++;
          else failed++;
        } catch (err) {
          console.error(
            `[WelcomeFallback] User ${user.id} (${user.email}) failed:`,
            err instanceof Error ? err.message : String(err),
          );
          failed++;
          // Leave welcomeEmailSentAt NULL — next tick retries.
        }
      }

      console.log(`[WelcomeFallback] Batch done: sent=${sent} failed=${failed}`);
    });
  } catch (err) {
    console.error(
      "[WelcomeFallback] Tick failed:",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    isRunning = false;
  }
}

export function startWelcomeEmailFallbackJob(): void {
  if (scheduledTask) return;
  console.log(`[WelcomeFallback] Starting with cron: ${FALLBACK_CRON}`);
  scheduledTask = cron.schedule(FALLBACK_CRON, runOnce);
}

export function stopWelcomeEmailFallbackJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

// Exported for tests + manual one-shot runs.
export { runOnce as runWelcomeFallbackOnce };
