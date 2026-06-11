/**
 * Platform health service — collects 10 metrics about the running
 * backend + DB and turns them into alert objects.
 *
 * Layered design:
 *   1. collectSnapshot()        — runs every check, returns numbers.
 *   2. evaluateSnapshot()       — applies thresholds → AlertResult[].
 *   3. processSnapshotAlerts()  — dedupes against PlatformHealthAlert
 *                                 and emits emails (one per incident).
 *
 * The job (jobs/platformHealthJob.ts) calls (1) → (2) → (3) every
 * 5 min. The /admin/health/deep endpoint calls (1) + (2) on demand.
 *
 * Every threshold is env-overridable. Defaults are tuned for the
 * pre-WC scale (~3.5K users) and the WC-eve incident pattern (DB
 * connection exhaustion at 100 max).
 */

import os from "os";
import { prisma } from "../db";
import { sendAdminNotification } from "../lib/email";
import { getEventLoopP99Ms } from "../lib/eventLoopMonitor";
import { lastMinuteRateLimitHits } from "../lib/rateLimitMetrics";
import { getAllHeartbeats, MONITORED_JOBS } from "../lib/cronHeartbeat";
import { getLastDashboardBuildMs } from "../routes/adminAnalyticsDashboard";
import { getScoresServiceClient } from "./scoresService";

// ───────────────────────── Types ─────────────────────────

export type Severity = "OK" | "WARN" | "CRITICAL";

export interface MetricResult {
  key: string;
  label: string;
  /** Numeric measurement — %, ms, or count. The `unit` field disambiguates. */
  value: number;
  unit: "pct" | "ms" | "count" | "boolean";
  warnThreshold: number;
  criticalThreshold: number;
  /** Free-form context to render in the alert email (e.g. job name list). */
  details?: string;
  /** Severity derived in evaluateSnapshot; populated for the API/email. */
  severity?: Severity;
}

export interface HealthSnapshot {
  generatedAtUtc: string;
  metrics: MetricResult[];
}

// ──────────────────────── Thresholds ─────────────────────

const envInt = (key: string, fallback: number): number =>
  parseInt(process.env[key] || String(fallback), 10);

const T = {
  // DB connection saturation (% of max_connections). The WC-eve incident
  // pegged at 100% and toppled fixtureTrackingJob; 65/85 leaves headroom.
  dbConnectionsWarn:    envInt("HEALTH_DB_CONN_WARN_PCT", 65),
  dbConnectionsCritical: envInt("HEALTH_DB_CONN_CRIT_PCT", 85),

  // Round-trip latency of a trivial SELECT 1. Captures both network and
  // pool-wait time. Anything >800 ms means we're queueing.
  dbLatencyWarnMs:      envInt("HEALTH_DB_LATENCY_WARN_MS", 200),
  dbLatencyCriticalMs:  envInt("HEALTH_DB_LATENCY_CRIT_MS", 800),

  // RSS as % of the Railway memory limit. Limit comes from env (Railway
  // exposes it as RAILWAY_MEMORY_LIMIT_BYTES on some plans); falls back
  // to the configurable HEALTH_MEMORY_LIMIT_MB or os.totalmem().
  memoryWarn:           envInt("HEALTH_MEMORY_WARN_PCT", 70),
  memoryCritical:       envInt("HEALTH_MEMORY_CRIT_PCT", 90),

  // Event-loop p99 over the last 30s. >100ms is "the box is busy",
  // >500ms is "users are seeing latency".
  eventLoopWarnMs:      envInt("HEALTH_EVENT_LOOP_WARN_MS", 100),
  eventLoopCriticalMs:  envInt("HEALTH_EVENT_LOOP_CRIT_MS", 500),

  // Overdue cron jobs (count of monitored jobs past their grace window).
  overdueJobsWarn:      envInt("HEALTH_OVERDUE_JOBS_WARN", 1),
  overdueJobsCritical:  envInt("HEALTH_OVERDUE_JOBS_CRIT", 2),

  // 429 emissions per minute. Bursts >50/min mean traffic spike OR abuse.
  rateLimitWarn:        envInt("HEALTH_RATE_LIMIT_WARN_PER_MIN", 50),
  rateLimitCritical:    envInt("HEALTH_RATE_LIMIT_CRIT_PER_MIN", 500),

  // PaymentEvent rows older than 10min whose PoolPayment is still PENDING.
  stuckWebhooksWarn:     envInt("HEALTH_STUCK_WEBHOOKS_WARN", 5),
  stuckWebhooksCritical: envInt("HEALTH_STUCK_WEBHOOKS_CRIT", 20),

  // Users with no welcomeEmailSentAt 2h+ after signup.
  stuckWelcomeWarn:     envInt("HEALTH_STUCK_WELCOME_WARN", 10),
  stuckWelcomeCritical: envInt("HEALTH_STUCK_WELCOME_CRIT", 50),

  // picks4all-scores GET /health round-trip ms (or non-200 → critical).
  scoresLatencyWarnMs:     envInt("HEALTH_SCORES_LATENCY_WARN_MS", 2000),
  scoresLatencyCriticalMs: envInt("HEALTH_SCORES_LATENCY_CRIT_MS", 10000),

  // Last analytics dashboard build duration.
  dashboardBuildWarnMs:     envInt("HEALTH_DASHBOARD_BUILD_WARN_MS", 20_000),
  dashboardBuildCriticalMs: envInt("HEALTH_DASHBOARD_BUILD_CRIT_MS", 45_000),

  // Anti-spam: re-send the same alert at most every N hours.
  alertCooldownHours: envInt("HEALTH_ALERT_COOLDOWN_HOURS", 6),
};

// ──────────────────────── Collectors ─────────────────────

/**
 * Each collector is independent and may not throw — a single broken
 * metric must never blind the rest of the dashboard. Wrappers return
 * an OK-styled MetricResult with details="failed: ..." on error.
 */
async function safeCollect(
  key: string,
  label: string,
  unit: MetricResult["unit"],
  warn: number,
  crit: number,
  fn: () => Promise<{ value: number; details?: string }>,
): Promise<MetricResult> {
  try {
    const { value, details } = await fn();
    return { key, label, unit, value, warnThreshold: warn, criticalThreshold: crit, details };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      key,
      label,
      unit,
      value: 0,
      warnThreshold: warn,
      criticalThreshold: crit,
      details: `failed to measure: ${msg}`,
    };
  }
}

async function dbConnectionsMetric(): Promise<MetricResult> {
  return safeCollect(
    "db_connections",
    "Conexiones a Postgres",
    "pct",
    T.dbConnectionsWarn,
    T.dbConnectionsCritical,
    async () => {
      const rows = await prisma.$queryRaw<{ used: bigint; max: number }[]>`
        SELECT
          (SELECT count(*)::bigint FROM pg_stat_activity WHERE datname = current_database()) AS used,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max
      `;
      const row = rows[0];
      if (!row) return { value: 0, details: "pg_stat_activity returned empty" };
      const used = Number(row.used);
      const max = Number(row.max);
      const pct = max > 0 ? (used / max) * 100 : 0;
      return { value: Math.round(pct * 10) / 10, details: `${used} / ${max} conexiones activas` };
    },
  );
}

async function dbLatencyMetric(): Promise<MetricResult> {
  return safeCollect(
    "db_latency",
    "Latencia DB (SELECT 1)",
    "ms",
    T.dbLatencyWarnMs,
    T.dbLatencyCriticalMs,
    async () => {
      const started = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const ms = Date.now() - started;
      return { value: ms, details: `${ms}ms round-trip` };
    },
  );
}

function memoryLimitBytes(): number {
  const fromRailway = parseInt(process.env.RAILWAY_MEMORY_LIMIT_BYTES || "", 10);
  if (Number.isFinite(fromRailway) && fromRailway > 0) return fromRailway;
  const fromEnvMb = parseInt(process.env.HEALTH_MEMORY_LIMIT_MB || "", 10);
  if (Number.isFinite(fromEnvMb) && fromEnvMb > 0) return fromEnvMb * 1024 * 1024;
  return os.totalmem();
}

async function memoryMetric(): Promise<MetricResult> {
  return safeCollect(
    "memory",
    "Memoria del backend (RSS)",
    "pct",
    T.memoryWarn,
    T.memoryCritical,
    async () => {
      const used = process.memoryUsage().rss;
      const limit = memoryLimitBytes();
      const pct = (used / limit) * 100;
      const mb = (n: number) => Math.round(n / 1024 / 1024);
      return {
        value: Math.round(pct * 10) / 10,
        details: `${mb(used)}MB / ${mb(limit)}MB`,
      };
    },
  );
}

async function eventLoopMetric(): Promise<MetricResult> {
  return safeCollect(
    "event_loop_lag",
    "Event-loop p99 (30s)",
    "ms",
    T.eventLoopWarnMs,
    T.eventLoopCriticalMs,
    async () => {
      const lag = getEventLoopP99Ms();
      return { value: Math.round(lag), details: `${Math.round(lag)}ms p99 sobre 30s` };
    },
  );
}

async function overdueJobsMetric(): Promise<MetricResult> {
  return safeCollect(
    "overdue_jobs",
    "Jobs caídos",
    "count",
    T.overdueJobsWarn,
    T.overdueJobsCritical,
    async () => {
      const beats = getAllHeartbeats();
      const now = Date.now();
      const overdue: string[] = [];
      for (const job of MONITORED_JOBS) {
        const last = beats[job.name];
        if (last === undefined) {
          // Never beat — could be a freshly-deployed pod that hasn't
          // run yet. Allow one full interval before flagging.
          continue;
        }
        const overdueAfterMs = job.intervalMin * 60_000 * job.overdueMultiplier;
        if (now - last > overdueAfterMs) {
          overdue.push(`${job.name} (último: hace ${Math.round((now - last) / 60_000)}min)`);
        }
      }
      return {
        value: overdue.length,
        details: overdue.length > 0 ? overdue.join(", ") : "todos al día",
      };
    },
  );
}

async function rateLimitMetric(): Promise<MetricResult> {
  return safeCollect(
    "rate_limit_hits",
    "429s emitidos (último min)",
    "count",
    T.rateLimitWarn,
    T.rateLimitCritical,
    async () => {
      const hits = lastMinuteRateLimitHits();
      return { value: hits, details: `${hits} respuestas 429 en los últimos 60s` };
    },
  );
}

async function stuckWebhooksMetric(): Promise<MetricResult> {
  return safeCollect(
    "stuck_webhooks",
    "Pagos PENDING con webhook viejo",
    "count",
    T.stuckWebhooksWarn,
    T.stuckWebhooksCritical,
    async () => {
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "PaymentEvent" pe
        JOIN "PoolPayment" pp ON pp.id = pe."poolPaymentId"
        WHERE pe."createdAtUtc" < NOW() - INTERVAL '10 minutes'
          AND pp.status = 'PENDING'
      `;
      const n = Number(rows[0]?.count ?? 0);
      return { value: n, details: `${n} PoolPayment PENDING con PaymentEvent > 10min` };
    },
  );
}

async function stuckWelcomeEmailsMetric(): Promise<MetricResult> {
  return safeCollect(
    "stuck_welcome_emails",
    "Welcome emails sin enviar (>2h)",
    "count",
    T.stuckWelcomeWarn,
    T.stuckWelcomeCritical,
    async () => {
      // Only flag users who could realistically have received it: the
      // verified-email branch (signup path) and the corporate-activated
      // branch (authService.activateCorporateAccount sets emailVerified
      // = true atomically), so emailVerified covers both cases. Users
      // sitting on an unverified address are correctly waiting on email
      // confirmation, not stuck.
      const n = await prisma.user.count({
        where: {
          createdAtUtc: { lt: new Date(Date.now() - 2 * 3600 * 1000) },
          welcomeEmailSentAt: null,
          emailVerified: true,
        },
      });
      return { value: n, details: `${n} usuarios sin welcome >2h después de signup` };
    },
  );
}

async function scoresServiceMetric(): Promise<MetricResult> {
  return safeCollect(
    "scores_service",
    "picks4all-scores /health",
    "ms",
    T.scoresLatencyWarnMs,
    T.scoresLatencyCriticalMs,
    async () => {
      const client = getScoresServiceClient();
      if (!client.isAvailable()) {
        return { value: 0, details: "scores service no configurado (skip)" };
      }
      const url = `${process.env.SCORES_SERVICE_URL?.replace(/\/+$/, "")}/health`;
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), T.scoresLatencyCriticalMs + 2000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const ms = Date.now() - started;
        if (!res.ok) {
          // Force CRITICAL by setting value past the critical threshold.
          return {
            value: T.scoresLatencyCriticalMs + 1,
            details: `HTTP ${res.status} en ${ms}ms`,
          };
        }
        return { value: ms, details: `HTTP 200 en ${ms}ms` };
      } finally {
        clearTimeout(timer);
      }
    },
  );
}

async function dashboardBuildMetric(): Promise<MetricResult> {
  return safeCollect(
    "dashboard_build",
    "Último build del dashboard",
    "ms",
    T.dashboardBuildWarnMs,
    T.dashboardBuildCriticalMs,
    async () => {
      const ms = getLastDashboardBuildMs();
      if (ms === 0) return { value: 0, details: "aún no se ha construido (post-boot)" };
      return { value: ms, details: `${ms}ms en la última corrida` };
    },
  );
}

// ─────────────────────── Snapshot ────────────────────────

export async function collectSnapshot(): Promise<HealthSnapshot> {
  const metrics = await Promise.all([
    dbConnectionsMetric(),
    dbLatencyMetric(),
    memoryMetric(),
    eventLoopMetric(),
    overdueJobsMetric(),
    rateLimitMetric(),
    stuckWebhooksMetric(),
    stuckWelcomeEmailsMetric(),
    scoresServiceMetric(),
    dashboardBuildMetric(),
  ]);
  return { generatedAtUtc: new Date().toISOString(), metrics };
}

export function evaluateSnapshot(snapshot: HealthSnapshot): HealthSnapshot {
  for (const m of snapshot.metrics) {
    if (m.unit === "boolean" || m.details?.startsWith("scores service no configurado")) {
      m.severity = "OK";
      continue;
    }
    if (m.value >= m.criticalThreshold) m.severity = "CRITICAL";
    else if (m.value >= m.warnThreshold) m.severity = "WARN";
    else m.severity = "OK";
  }
  return snapshot;
}

// ────────────────────── Alert pipeline ───────────────────

interface ProcessedAlerts {
  fired: number;
  resolved: number;
  suppressedByCooldown: number;
}

export async function processSnapshotAlerts(snapshot: HealthSnapshot): Promise<ProcessedAlerts> {
  const now = new Date();
  const cooldownMs = T.alertCooldownHours * 3600 * 1000;
  const counters: ProcessedAlerts = { fired: 0, resolved: 0, suppressedByCooldown: 0 };

  for (const m of snapshot.metrics) {
    const sev = m.severity ?? "OK";
    if (sev === "OK") {
      await maybeResolveAlert(m, now, counters);
      continue;
    }
    await maybeFireAlert(m, sev, now, cooldownMs, counters);
  }

  return counters;
}

async function maybeFireAlert(
  m: MetricResult,
  severity: "WARN" | "CRITICAL",
  now: Date,
  cooldownMs: number,
  counters: ProcessedAlerts,
): Promise<void> {
  // Look for an existing OPEN alert (resolvedAt IS NULL) for this
  // (key, severity). Upsert isn't ideal here because the unique index
  // includes resolvedAt — we do find-then-decide.
  const existing = await prisma.platformHealthAlert.findFirst({
    where: { alertKey: m.key, severity, resolvedAt: null },
  });

  if (existing) {
    // Already open — refresh observation and decide whether to renotify.
    const shouldRenotify =
      !existing.notifiedAt || now.getTime() - existing.notifiedAt.getTime() >= cooldownMs;
    await prisma.platformHealthAlert.update({
      where: { id: existing.id },
      data: {
        lastObservedAt: now,
        observedValue: m.value,
        details: m.details ?? null,
        ...(shouldRenotify ? { notifiedAt: now } : {}),
      },
    });
    if (shouldRenotify) {
      await sendAlertEmail(m, severity, /* isRecovery */ false);
      counters.fired++;
    } else {
      counters.suppressedByCooldown++;
    }
    return;
  }

  // No open alert at this severity. Brand new — fire immediately.
  await prisma.platformHealthAlert.create({
    data: {
      alertKey: m.key,
      severity,
      observedValue: m.value,
      threshold: severity === "CRITICAL" ? m.criticalThreshold : m.warnThreshold,
      details: m.details ?? null,
      notifiedAt: now,
    },
  });
  await sendAlertEmail(m, severity, /* isRecovery */ false);
  counters.fired++;
}

async function maybeResolveAlert(
  m: MetricResult,
  now: Date,
  counters: ProcessedAlerts,
): Promise<void> {
  // Resolve any open alert for this key (both severities).
  const openAlerts = await prisma.platformHealthAlert.findMany({
    where: { alertKey: m.key, resolvedAt: null },
  });
  for (const a of openAlerts) {
    await prisma.platformHealthAlert.update({
      where: { id: a.id },
      data: { resolvedAt: now, resolutionNotifiedAt: now },
    });
    await sendAlertEmail(m, a.severity, /* isRecovery */ true);
    counters.resolved++;
  }
}

async function sendAlertEmail(
  m: MetricResult,
  severity: "WARN" | "CRITICAL",
  isRecovery: boolean,
): Promise<void> {
  const emoji = isRecovery ? "✅" : severity === "CRITICAL" ? "🔴" : "🟡";
  const title = isRecovery
    ? `Resuelto: ${m.label}`
    : `${severity === "CRITICAL" ? "Crítico" : "Advertencia"}: ${m.label}`;
  const unitLabel = m.unit === "pct" ? "%" : m.unit === "ms" ? "ms" : "";
  const body = `
    <p>${emoji} <strong>${m.label}</strong></p>
    <ul>
      <li><strong>Valor observado:</strong> ${m.value}${unitLabel}</li>
      <li><strong>Umbral ${severity === "CRITICAL" ? "crítico" : "warn"}:</strong> ${
        severity === "CRITICAL" ? m.criticalThreshold : m.warnThreshold
      }${unitLabel}</li>
      <li><strong>Detalle:</strong> ${m.details ?? "(sin detalle adicional)"}</li>
      <li><strong>Métrica:</strong> <code>${m.key}</code></li>
    </ul>
    ${
      isRecovery
        ? "<p>La métrica volvió a estado OK. No se requiere acción.</p>"
        : "<p>Revisa logs del backend y la métrica indicada. " +
          "Más detalles en <code>GET /admin/health/deep</code>.</p>"
    }
  `;
  await sendAdminNotification({
    subject: title,
    body,
    category: "error",
  }).catch((err) => {
    console.error(
      "[platformHealth] sendAdminNotification failed:",
      err instanceof Error ? err.message : String(err),
    );
  });
}
