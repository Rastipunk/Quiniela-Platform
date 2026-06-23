"use client";

/**
 * Admin Analytics Dashboard
 *
 * Comprehensive growth/health dashboard pulling from
 * `GET /admin/analytics/dashboard`. Polls every 30s by default with
 * a configurable interval, manual refresh, and a pause toggle.
 * Backend is admin-gated so non-admin users hit 403 and see an
 * "access denied" state.
 */

import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Link } from "@/i18n/navigation";
import {
  getAdminAnalyticsDashboard,
  triggerAdminAnalyticsRebuild,
  type AnalyticsDashboardResponse,
  type AnalyticsDashboardNotReady,
} from "@/lib/api";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  colors,
  radii,
  spacing,
  fontSize,
  fontWeight,
  shadows,
} from "@/lib/theme";

// ─── Rebuild polling ────────────────────────────────────────
// After a manual rebuild is triggered, poll the snapshot every POLL_MS until
// it reports done (building:false + a newer generatedAtUtc), giving up after
// REBUILD_MAX_MS so a stuck build can't spin forever.
const REBUILD_POLL_MS = 5_000;
const REBUILD_MAX_MS = 15 * 60 * 1000; // 15 min hard cap

// ─── Chart palette ──────────────────────────────────────────

const PALETTE = {
  primary: colors.brand,
  primaryLight: colors.brandLight,
  primaryDark: colors.brandDark,
  success: colors.success,
  successAlt: colors.successAlt,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
  purple: colors.purple,
  border: colors.borderLight,
  muted: colors.textMuted,
  text: colors.text,
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: colors.warning,
  ACTIVE: colors.success,
  COMPLETED: colors.info,
  ARCHIVED: colors.textLight,
};

// ─── Format helpers ─────────────────────────────────────────

function fmtInt(n: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(n));
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtUsd(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)}`;
}
function fmtCop(pesos: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(pesos)}`;
}
function fmtRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.round(h / 24)}d`;
}

// ─── Layout primitives ──────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: spacing.md }}>
      <h2
        style={{
          margin: 0,
          fontSize: fontSize["2xl"],
          fontWeight: fontWeight.bold,
          color: colors.text,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            fontSize: fontSize.sm,
            color: colors.textMuted,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Card({
  children,
  title,
  subtitle,
  span,
  isMobile,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  span?: number;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        gridColumn: !isMobile && span ? `span ${span}` : undefined,
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radii["3xl"],
        padding: isMobile ? spacing.lg : spacing.xl,
        boxShadow: shadows.sm,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        minWidth: 0,
      }}
    >
      {title && (
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                margin: `${spacing.xs}px 0 0`,
                fontSize: fontSize.xs,
                color: colors.textMuted,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  isMobile,
  delta,
  deltaSuffix,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  isMobile: boolean;
  /** Week-over-week change (absolute number). Null = not computable. */
  delta?: number | null;
  /** Optional unit shown after the delta number ("USD", "COP", etc.). */
  deltaSuffix?: string;
}) {
  return (
    <div
      style={{
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radii["2xl"],
        padding: isMobile ? `${spacing.md}px ${spacing.md}px` : `${spacing.lg}px ${spacing.lg}px`,
        boxShadow: shadows.sm,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {accent && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accent,
          }}
        />
      )}
      <div
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          lineHeight: 1.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          margin: `${spacing.xs}px 0 0`,
          fontSize: isMobile ? fontSize["3xl"] : fontSize["4xl"],
          fontWeight: fontWeight.extrabold,
          color: colors.text,
          letterSpacing: -0.5,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            marginTop: spacing.xs,
            fontSize: fontSize.xs,
            color: colors.textLight,
          }}
        >
          {hint}
        </div>
      )}
      {delta !== undefined && delta !== null && (
        <div
          style={{
            marginTop: spacing.xs,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: radii.pill,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
            color: delta > 0
              ? PALETTE.success
              : delta < 0
                ? PALETTE.error
                : colors.textMuted,
            background: delta > 0
              ? `${PALETTE.success}15`
              : delta < 0
                ? `${PALETTE.error}15`
                : `${colors.textMuted}15`,
          }}
          title="Cambio vs. hace 7 días"
        >
          <span>{delta > 0 ? "▲" : delta < 0 ? "▼" : "·"}</span>
          <span>
            {delta > 0 ? "+" : ""}{deltaSuffix === "USD" ? fmtUsd(delta) : deltaSuffix === "COP" ? fmtCop(delta) : fmtInt(delta)}
            <span style={{ color: colors.textMuted, marginLeft: 4, fontWeight: fontWeight.normal }}>esta semana</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────

export default function AdminAnalyticsContent() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<
    AnalyticsDashboardResponse | AnalyticsDashboardNotReady | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  // True while a manual rebuild runs (after the button → POST → polling).
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const fetchSeqRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch (read-only: serves the stored snapshot, never recomputes) ──

  async function fetchDashboard() {
    const seq = ++fetchSeqRef.current;
    try {
      const result = await getAdminAnalyticsDashboard();
      if (seq !== fetchSeqRef.current) return; // a newer fetch already won
      setData(result);
      setError(null);
      setAccessDenied(false);
      setLastFetchAt(new Date());
      // If the server reports a build already in flight (e.g. the boot seed),
      // reflect it so the UI shows the building state and starts polling.
      if (result.building && !rebuilding) startRebuildPolling(currentGeneratedAt(result));
    } catch (err: any) {
      if (err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err.message ?? "Error cargando analítica");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Manual rebuild: trigger async build, then poll until it lands ──

  function currentGeneratedAt(
    d: AnalyticsDashboardResponse | AnalyticsDashboardNotReady | null,
  ): string | null {
    return d && d.ready !== false ? d.generatedAtUtc : null;
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function startRebuildPolling(baselineGeneratedAt: string | null) {
    setRebuilding(true);
    setRebuildError(null);
    const startedAt = Date.now();
    const poll = async () => {
      if (Date.now() - startedAt > REBUILD_MAX_MS) {
        setRebuilding(false);
        setRebuildError("El cálculo está tardando demasiado. Intenta de nuevo más tarde.");
        return;
      }
      try {
        const r = await getAdminAnalyticsDashboard();
        if (r.ready !== false) {
          setData(r);
          setLastFetchAt(new Date());
          const isNewer = baselineGeneratedAt === null || r.generatedAtUtc !== baselineGeneratedAt;
          if (!r.building && isNewer) {
            setRebuilding(false);
            return; // fresh snapshot landed — done
          }
        }
      } catch {
        /* transient — keep polling */
      }
      pollTimerRef.current = setTimeout(poll, REBUILD_POLL_MS);
    };
    pollTimerRef.current = setTimeout(poll, REBUILD_POLL_MS);
  }

  async function handleRebuild() {
    if (rebuilding) return;
    const baseline = currentGeneratedAt(data);
    setRebuilding(true);
    setRebuildError(null);
    try {
      await triggerAdminAnalyticsRebuild();
    } catch (err: any) {
      setRebuilding(false);
      setRebuildError(err?.message ?? "No se pudo iniciar el cálculo");
      return;
    }
    startRebuildPolling(baseline);
  }

  useEffect(() => {
    fetchDashboard();
    return stopPolling; // clean up the poll timer on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force re-render every 5s so "hace Xs" stays accurate
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // ── Access denied ───────────────────────────────────────
  if (accessDenied) {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: "60px auto",
          padding: spacing["3xl"],
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>🔒</div>
        <h2 style={{ margin: 0, fontSize: fontSize["3xl"], fontWeight: fontWeight.bold }}>
          Acceso restringido
        </h2>
        <p style={{ margin: `${spacing.md}px 0`, color: colors.textMuted, lineHeight: 1.6 }}>
          Esta sección solo está disponible para administradores de plataforma.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: `${spacing.md}px ${spacing.xl}px`,
            borderRadius: radii.lg,
            background: colors.brand,
            color: colors.white,
            textDecoration: "none",
            fontWeight: fontWeight.semibold,
          }}
        >
          Volver
        </Link>
      </div>
    );
  }

  // ── Loading / error ─────────────────────────────────────
  if (loading && !data) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: spacing.xl }}>
        <SectionHeader title="📊 Analítica" subtitle="Cargando dashboard..." />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: spacing.xl }}>
        <SectionHeader title="📊 Analítica" />
        <div
          style={{
            padding: spacing.lg,
            background: colors.errorBg,
            border: `1px solid ${colors.errorBorder}`,
            borderRadius: radii.lg,
            color: colors.error,
            fontSize: fontSize.sm,
          }}
        >
          {error}
        </div>
      </div>
    );
  }
  if (!data) return null;

  // ── No snapshot ever built (brand-new install) ──────────
  if (data.ready === false) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: spacing.xl }}>
        <FirstReportState onRebuild={handleRebuild} rebuilding={rebuilding} error={rebuildError} />
      </div>
    );
  }

  // From here `data` is a full (ready) snapshot.

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: isMobile ? spacing.md : spacing.xl,
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? spacing.xl : spacing["2xl"],
      }}
    >
      {/* Header */}
      <DashboardHeader
        data={data}
        lastFetchAt={lastFetchAt}
        rebuilding={rebuilding}
        rebuildError={rebuildError}
        onRebuild={handleRebuild}
        isMobile={isMobile}
      />

      {/* Section errors banner */}
      {data.errors && data.errors.length > 0 && (
        <SectionErrorsBanner errors={data.errors} />
      )}

      {/* Section nav (sticky chips for jumping to a section) */}
      <SectionNav isMobile={isMobile} />

      {/* Top-line KPIs (with WoW deltas where deltable) */}
      <section id="topline" style={{ scrollMarginTop: 72 }}>
        <TopLineSection topLine={data.topLine} weekAgo={data.topLineWeekAgo} isMobile={isMobile} />
      </section>

      <Section id="locale" title="🌐 Distribución de idioma" subtitle="Idioma elegido en el modal de primer login + cuántos siguen pendientes">
        <LocaleDistributionSection data={data.localeDistribution} isMobile={isMobile} />
      </Section>

      <Section id="users" title="📈 Crecimiento de usuarios" subtitle="Signups por semana, últimas 12 semanas">
        <SignupsChart data={data.signupsByWeek} isMobile={isMobile} />
      </Section>

      <Section id="pools" title="🏆 Crecimiento de pools" subtitle="Pools creadas por semana, split personal vs corporativo">
        <PoolsChart data={data.poolsByWeek} isMobile={isMobile} />
      </Section>

      <Section id="engagement" title="🎯 Engagement" subtitle="Usuarios activos, picks por semana, funnel de activación">
        <EngagementSection
          dailyActive={data.dailyActiveUsers}
          picksByWeek={data.picksByWeek}
          funnel={data.funnel}
          isMobile={isMobile}
        />
      </Section>

      <Section id="geo" title="🌎 Geografía" subtitle="Top 20 países por número de usuarios">
        <GeographySection data={data.usersByCountry} isMobile={isMobile} />
      </Section>

      <Section id="health" title="🩺 Salud de pools" subtitle="Status, tamaño, alertas">
        <PoolHealthSection
          byStatus={data.poolsByStatus}
          sizes={data.poolSizeDistribution}
          health={data.poolHealth}
          tournaments={data.poolsByTournament}
          isMobile={isMobile}
        />
      </Section>

      <Section id="corporate" title="🏢 Funnel corporativo" subtitle="Inquiries → activaciones">
        <CorporateSection
          funnel={data.corporateFunnel}
          orgs={data.topOrganizations}
          inquiries={data.recentInquiries}
          isMobile={isMobile}
        />
      </Section>

      <Section id="revenue" title="💰 Revenue" subtitle="Pagos completados por semana, breakdown por proveedor y tier">
        <RevenueSection
          weekly={data.revenueByWeek}
          payment={data.paymentBreakdown}
          totalUsd={data.topLine.totalRevenueUsd}
          totalCop={data.topLine.totalRevenueCop}
          isMobile={isMobile}
        />
      </Section>

      <Section id="acquisition" title="📡 Adquisición" subtitle="Source / medium UTM, conversión por canal, referidos orgánicos">
        <AcquisitionSection
          topAcquisition={data.topAcquisition}
          acquisitionFunnel={data.acquisitionFunnel}
          referrals={data.organicReferrals}
          isMobile={isMobile}
        />
      </Section>

      <Section id="activation" title="⚡ Activación por cohorte" subtitle="% de signups de cada semana que hicieron al menos un pick en sus primeros 14 días">
        <CohortActivationSection data={data.cohortActivation} isMobile={isMobile} />
      </Section>

      <Section id="who" title="🌟 Quién está usando Picks4All" subtitle="Top jugadores (30d), hosts más activos, tournaments con más actividad">
        <EngagementSignalsSection data={data.engagementSignals} isMobile={isMobile} />
      </Section>

      <Section id="comms" title="📬 Comunicación con usuarios" subtitle="Modal de idioma, deliverability de email, feedback recibido">
        <CommunicationsSection data={data.communicationsHealth} isMobile={isMobile} />
      </Section>

      <Section id="retention" title="🔄 Retención por cohorte" subtitle="% de signups que volvieron a hacer un pick en W1, W2 y W4">
        <CohortSection data={data.cohortRetention} isMobile={isMobile} />
      </Section>

      <Section id="ops" title="🔧 Salud operacional" subtitle="Errores, suppressions, feedback reciente">
        <OperationalSection data={data.operationalHealth} isMobile={isMobile} />
      </Section>

      {/* Footer */}
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.textLight,
          textAlign: "center",
          padding: spacing.md,
        }}
      >
        Snapshot generado {fmtRelativeTime(data.generatedAtUtc)} · TTL caché:{" "}
        {data.cacheTtlSeconds}s {data.cached ? "· (cache hit)" : "· (fresh)"}
      </div>
    </div>
  );
}

// ─── Sticky section nav (table-of-contents chips) ──────────

const SECTION_NAV: Array<{ id: string; label: string }> = [
  { id: "topline", label: "📊 KPIs" },
  { id: "locale", label: "🌐 Idioma" },
  { id: "users", label: "📈 Usuarios" },
  { id: "pools", label: "🏆 Pools" },
  { id: "engagement", label: "🎯 Engagement" },
  { id: "geo", label: "🌎 Geografía" },
  { id: "health", label: "🩺 Salud pools" },
  { id: "corporate", label: "🏢 Corporate" },
  { id: "revenue", label: "💰 Revenue" },
  { id: "acquisition", label: "📡 Adquisición" },
  { id: "activation", label: "⚡ Activación" },
  { id: "who", label: "🌟 Quién usa" },
  { id: "comms", label: "📬 Comunicación" },
  { id: "retention", label: "🔄 Retención" },
  { id: "ops", label: "🔧 Operacional" },
];

function SectionNav({ isMobile }: { isMobile: boolean }) {
  return (
    <nav
      aria-label="Saltar a sección"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: `${colors.white}EE`,
        backdropFilter: "blur(10px)",
        margin: isMobile ? `0 -${spacing.md}px` : `0 -${spacing.xl}px`,
        padding: `${spacing.sm}px ${isMobile ? spacing.md : spacing.xl}px`,
        borderBottom: `1px solid ${colors.borderLight}`,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: isMobile ? "nowrap" : "wrap" }}>
        {SECTION_NAV.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              flexShrink: 0,
              padding: "6px 10px",
              borderRadius: radii.pill,
              border: `1px solid ${colors.borderLight}`,
              background: colors.white,
              color: colors.text,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${PALETTE.primary}10`;
              e.currentTarget.style.borderColor = PALETTE.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.white;
              e.currentTarget.style.borderColor = colors.borderLight;
            }}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ─── Section errors banner ──────────────────────────────────

function SectionErrorsBanner({
  errors,
}: {
  errors: { section: string; message: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        border: `1px solid ${colors.error}`,
        borderRadius: radii.md,
        padding: spacing.md,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: colors.error,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          textAlign: "left",
        }}
      >
        <span>
          ⚠️ {errors.length} secci{errors.length === 1 ? "ón" : "ones"} con
          errores — los demás datos se cargaron correctamente
        </span>
        <span style={{ fontSize: fontSize.xs }}>
          {expanded ? "Ocultar ▲" : "Ver detalle ▼"}
        </span>
      </button>
      {expanded && (
        <ul
          style={{
            marginTop: spacing.sm,
            marginBottom: 0,
            paddingLeft: spacing.lg,
            color: colors.text,
            fontSize: fontSize.xs,
            display: "flex",
            flexDirection: "column",
            gap: spacing.xs,
          }}
        >
          {errors.map((err, i) => (
            <li key={`${err.section}-${i}`}>
              <strong>{err.section}:</strong>{" "}
              <code style={{ color: colors.textMuted }}>{err.message}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────

function DashboardHeader({
  data,
  lastFetchAt,
  rebuilding,
  rebuildError,
  onRebuild,
  isMobile,
}: {
  data: AnalyticsDashboardResponse;
  lastFetchAt: Date | null;
  rebuilding: boolean;
  rebuildError: string | null;
  onRebuild: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "flex-start" : "center",
        gap: spacing.md,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? fontSize["3xl"] : fontSize["4xl"],
            fontWeight: fontWeight.extrabold,
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          📊 Analítica
        </h1>
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            color: colors.textMuted,
            fontSize: fontSize.sm,
          }}
        >
          Última actualización: {fmtRelativeTime(data.generatedAtUtc)}
          {lastFetchAt && ` · cargado ${fmtRelativeTime(lastFetchAt.toISOString())}`}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: spacing.xs }}>
        <button
          type="button"
          onClick={onRebuild}
          disabled={rebuilding}
          style={{
            padding: "10px 18px",
            borderRadius: radii.lg,
            border: "none",
            background: rebuilding ? colors.disabled : colors.brand,
            color: colors.white,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            cursor: rebuilding ? "wait" : "pointer",
            boxShadow: rebuilding ? "none" : shadows.sm,
            whiteSpace: "nowrap",
          }}
        >
          {rebuilding ? "⏳ Recalculando…" : "🔄 Recalcular ahora"}
        </button>
        <span style={{ fontSize: fontSize.xs, color: rebuildError ? colors.error : colors.textMuted, maxWidth: 280, textAlign: isMobile ? "left" : "right" }}>
          {rebuildError
            ? rebuildError
            : rebuilding
              ? "Puede tardar varios minutos; los datos se actualizan al terminar."
              : "Los datos no se recalculan solos — usa este botón."}
        </span>
      </div>
    </div>
  );
}

// ─── First-report (no snapshot yet) ─────────────────────────

function FirstReportState({
  onRebuild,
  rebuilding,
  error,
}: {
  onRebuild: () => void;
  rebuilding: boolean;
  error: string | null;
}) {
  return (
    <div style={{ textAlign: "center", padding: `${spacing["3xl"]}px ${spacing.xl}px` }}>
      <div style={{ fontSize: 48, marginBottom: spacing.md }}>📊</div>
      <h2 style={{ margin: 0, fontSize: fontSize["3xl"], fontWeight: fontWeight.bold }}>
        Aún no hay reporte
      </h2>
      <p style={{ margin: `${spacing.md}px auto`, maxWidth: 460, color: colors.textMuted, lineHeight: 1.6 }}>
        El reporte de analítica se calcula bajo demanda. Genera el primero ahora;
        puede tardar varios minutos y luego quedará disponible al instante.
      </p>
      <button
        type="button"
        onClick={onRebuild}
        disabled={rebuilding}
        style={{
          padding: "12px 24px",
          borderRadius: radii.lg,
          border: "none",
          background: rebuilding ? colors.disabled : colors.brand,
          color: colors.white,
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
          cursor: rebuilding ? "wait" : "pointer",
        }}
      >
        {rebuilding ? "⏳ Calculando…" : "Generar reporte"}
      </button>
      {error && (
        <p style={{ marginTop: spacing.md, color: colors.error, fontSize: fontSize.sm }}>{error}</p>
      )}
    </div>
  );
}

// ─── Top-line KPIs ──────────────────────────────────────────

function TopLineSection({
  topLine,
  weekAgo,
  isMobile,
}: {
  topLine: AnalyticsDashboardResponse["topLine"];
  weekAgo: AnalyticsDashboardResponse["topLineWeekAgo"];
  isMobile: boolean;
}) {
  // Δ is the absolute movement from the snapshot 7 days ago. We render it
  // as a chip on the card. NULL means "not deltable" (point-in-time fields
  // like draftPools / pendingApprovalMembers that we don't snapshot).
  const kpis: { label: string; value: string; hint?: string; accent?: string; delta?: number | null; deltaSuffix?: string }[] = [
    {
      label: "Usuarios totales",
      value: fmtInt(topLine.totalUsers),
      hint: `${fmtInt(topLine.verifiedUsers)} verificados (${fmtPct(topLine.verifiedUsers / Math.max(1, topLine.totalUsers))})`,
      accent: PALETTE.primary,
      delta: topLine.totalUsers - (weekAgo?.totalUsers ?? topLine.totalUsers),
    },
    {
      label: "Activos 7d",
      value: fmtInt(topLine.activeUsers7d),
      hint: `${fmtInt(topLine.activeUsers30d)} activos 30d`,
      accent: PALETTE.success,
      delta: topLine.activeUsers7d - (weekAgo?.activeUsers7d ?? topLine.activeUsers7d),
    },
    {
      label: "Pools totales",
      value: fmtInt(topLine.totalPools),
      hint: `${fmtInt(topLine.activePools)} activas · ${fmtInt(topLine.completedPools)} completadas`,
      accent: PALETTE.info,
      delta: topLine.totalPools - (weekAgo?.totalPools ?? topLine.totalPools),
    },
    {
      label: "Pools personales",
      value: fmtInt(topLine.personalPools),
      hint: `${fmtInt(topLine.corporatePools)} corporativas`,
      accent: PALETTE.purple,
      delta: null,
    },
    {
      label: "Organizaciones",
      value: fmtInt(topLine.totalOrganizations),
      hint: `${fmtInt(topLine.pendingInquiries)} inquiries sin responder`,
      accent: PALETTE.warning,
      delta: null,
    },
    {
      label: "Invitaciones activadas",
      value: `${fmtInt(topLine.activatedInvites)} / ${fmtInt(topLine.totalCorporateInvites)}`,
      hint: fmtPct(topLine.inviteActivationRate),
      accent: PALETTE.successAlt,
      delta: topLine.activatedInvites - (weekAgo?.activatedInvites ?? topLine.activatedInvites),
    },
    {
      label: "Revenue USD",
      value: fmtUsd(topLine.totalRevenueUsd),
      hint: "histórico, pagos completados",
      accent: PALETTE.success,
      delta: topLine.totalRevenueUsd - (weekAgo?.totalRevenueUsd ?? topLine.totalRevenueUsd),
      deltaSuffix: "USD",
    },
    {
      label: "Revenue COP",
      value: fmtCop(topLine.totalRevenueCop),
      hint: "histórico, pagos completados",
      accent: PALETTE.success,
      delta: topLine.totalRevenueCop - (weekAgo?.totalRevenueCop ?? topLine.totalRevenueCop),
      deltaSuffix: "COP",
    },
    {
      label: "Picks totales",
      value: fmtInt(topLine.totalPicks ?? topLine.totalMatchPicks + topLine.totalStructuralPicks + (topLine.totalGroupStandingsPicks ?? 0)),
      hint: `${fmtInt(topLine.totalMatchPicks)} marcador · ${fmtInt((topLine.totalGroupStandingsPicks ?? 0))} grupos · ${fmtInt(topLine.totalStructuralPicks)} eliminatoria`,
      accent: PALETTE.primaryLight,
      delta: (topLine.totalPicks ?? 0) - (weekAgo?.totalPicks ?? 0),
    },
    {
      label: "Pendientes de aprobar",
      value: fmtInt(topLine.pendingApprovalMembers),
      hint: "miembros esperando OK del host",
      accent: PALETTE.warning,
      delta: null,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "repeat(2, minmax(0, 1fr))"
          : "repeat(auto-fit, minmax(200px, 1fr))",
        gap: spacing.md,
      }}
    >
      {kpis.map((k) => (
        <KpiCard key={k.label} {...k} isMobile={isMobile} />
      ))}
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // `id` lets the sticky section-nav scroll-anchor each section. The
  // small scroll-margin offsets the sticky bar height so the title
  // isn't hidden under it when jumping in.
  return (
    <section id={id} style={{ scrollMarginTop: 72 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}

// ─── Chart sections ─────────────────────────────────────────

function SignupsChart({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["signupsByWeek"];
  isMobile: boolean;
}) {
  return (
    <Card isMobile={isMobile}>
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
          <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total" stroke={PALETTE.primary} strokeWidth={2} name="Total" />
          <Line type="monotone" dataKey="verified" stroke={PALETTE.success} strokeWidth={2} name="Verificados" />
          <Line type="monotone" dataKey="google" stroke={PALETTE.info} strokeWidth={2} name="Google OAuth" />
          <Line type="monotone" dataKey="referred" stroke={PALETTE.purple} strokeWidth={2} name="Referidos" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function PoolsChart({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["poolsByWeek"];
  isMobile: boolean;
}) {
  return (
    <Card isMobile={isMobile}>
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
          <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="personal"
            stackId="1"
            stroke={PALETTE.primary}
            fill={PALETTE.primary}
            fillOpacity={0.7}
            name="Personal"
          />
          <Area
            type="monotone"
            dataKey="corporate"
            stackId="1"
            stroke={PALETTE.purple}
            fill={PALETTE.purple}
            fillOpacity={0.7}
            name="Corporate"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

function EngagementSection({
  dailyActive,
  picksByWeek,
  funnel,
  isMobile,
}: {
  dailyActive: AnalyticsDashboardResponse["dailyActiveUsers"];
  picksByWeek: AnalyticsDashboardResponse["picksByWeek"];
  funnel: AnalyticsDashboardResponse["funnel"];
  isMobile: boolean;
}) {
  const funnelRows = [
    { stage: "Signups", value: funnel.signups, pct: 1 },
    {
      stage: "Joined pool",
      value: funnel.joinedPool,
      pct: funnel.signups > 0 ? funnel.joinedPool / funnel.signups : 0,
    },
    {
      stage: "Made pick",
      value: funnel.madePick,
      pct: funnel.signups > 0 ? funnel.madePick / funnel.signups : 0,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Usuarios activos por día (últimos 30 días)" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
          <AreaChart data={dailyActive} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="uniqueActiveUsers"
              stroke={PALETTE.success}
              fill={PALETTE.success}
              fillOpacity={0.4}
              name="DAU"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Picks por semana" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
          <BarChart data={picksByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="matchPicks" fill={PALETTE.primary} name="Marcador" stackId="picks" />
            <Bar dataKey="groupStandingsPicks" fill={PALETTE.success} name="Grupos (Estratega)" stackId="picks" />
            <Bar dataKey="structuralPicks" fill={PALETTE.purple} name="Eliminatoria (Estratega)" stackId="picks" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Funnel de activación" subtitle="Signup → joined pool → made pick" isMobile={isMobile} span={2}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {funnelRows.map((r, i) => (
            <div key={r.stage} style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: spacing.xs,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                }}
              >
                <span>{r.stage}</span>
                <span>
                  {fmtInt(r.value)} <span style={{ color: colors.textMuted }}>({fmtPct(r.pct)})</span>
                </span>
              </div>
              <div style={{ height: 12, background: colors.bgLight, borderRadius: radii.pill, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${r.pct * 100}%`,
                    background:
                      i === 0
                        ? PALETTE.primary
                        : i === 1
                          ? PALETTE.successAlt
                          : PALETTE.success,
                    borderRadius: radii.pill,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              fontSize: fontSize.xs,
              color: colors.textMuted,
              marginTop: spacing.sm,
              padding: spacing.sm,
              background: colors.bgLight,
              borderRadius: radii.md,
              lineHeight: 1.5,
            }}
          >
            <b>Tasa de conversión joined → pick:</b> {fmtPct(funnel.pickRateOfJoiners)} ·{" "}
            <b>signups → pick:</b> {fmtPct(funnel.pickRateOfSignups)}
          </div>
        </div>
      </Card>
    </div>
  );
}

function GeographySection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["usersByCountry"];
  isMobile: boolean;
}) {
  return (
    <Card isMobile={isMobile}>
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 360}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="country" type="category" tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v, _name, p: any) =>
              `${fmtInt(Number(v))} (${fmtPct(p.payload.pct)})`
            }
          />
          <Bar dataKey="count" fill={PALETTE.primary} name="Usuarios" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function PoolHealthSection({
  byStatus,
  sizes,
  health,
  tournaments,
  isMobile,
}: {
  byStatus: AnalyticsDashboardResponse["poolsByStatus"];
  sizes: AnalyticsDashboardResponse["poolSizeDistribution"];
  health: AnalyticsDashboardResponse["poolHealth"];
  tournaments: AnalyticsDashboardResponse["poolsByTournament"];
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Por status" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={byStatus}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={45}
              paddingAngle={2}
              label={(e: any) => `${e.status}: ${e.count}`}
            >
              {byStatus.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.status] ?? PALETTE.primary} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Tamaños (miembros activos)" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sizes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill={PALETTE.primary} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Alertas" isMobile={isMobile}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <HealthRow label="Pools zombie (ACTIVE sin picks)" value={health.zombiePools} bad={health.zombiePools > 0} />
          <HealthRow label="Pools sin miembros (solo host)" value={health.poolsWithNoMembers} bad={false} />
          <HealthRow label="Drafts >30d sin completar" value={health.emptyDraftsOlderThan30Days} bad={health.emptyDraftsOlderThan30Days > 0} />
          <HealthRow label="Pools llenas" value={health.fullPools} bad={false} />
        </div>
      </Card>
      <Card title="Por torneo" isMobile={isMobile} span={3}>
        <Table
          headers={["Torneo", "Template", "Pools", "Avg miembros"]}
          rows={tournaments.slice(0, 10).map((t) => [
            t.name,
            t.templateKey ?? "—",
            fmtInt(t.poolCount),
            t.avgMembers.toFixed(1),
          ])}
        />
      </Card>
    </div>
  );
}

function HealthRow({ label, value, bad }: { label: string; value: number; bad: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.sm,
        background: bad ? colors.errorBg : colors.bgLight,
        borderRadius: radii.md,
        border: `1px solid ${bad ? colors.errorBorder : colors.borderLight}`,
        fontSize: fontSize.sm,
      }}
    >
      <span style={{ color: colors.textDark }}>{label}</span>
      <span
        style={{
          fontWeight: fontWeight.bold,
          color: bad ? colors.errorDark : colors.text,
          fontSize: fontSize.lg,
        }}
      >
        {fmtInt(value)}
      </span>
    </div>
  );
}

function CorporateSection({
  funnel,
  orgs,
  inquiries,
  isMobile,
}: {
  funnel: AnalyticsDashboardResponse["corporateFunnel"];
  orgs: AnalyticsDashboardResponse["topOrganizations"];
  inquiries: AnalyticsDashboardResponse["recentInquiries"];
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Funnel" isMobile={isMobile}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <FunnelRow label="Inquiries recibidas" value={funnel.inquiries} />
          <FunnelRow
            label="Respondidas"
            value={funnel.respondedInquiries}
            sub={`${fmtPct(funnel.responseRate)} respuesta`}
          />
          <FunnelRow label="Organizaciones activas" value={funnel.organizationsActive} />
          <FunnelRow label="Pools corporativas" value={funnel.corporatePools} />
          <FunnelRow label="Invitaciones enviadas (vigentes)" value={funnel.invitesSent} />
          <FunnelRow
            label="Activadas"
            value={funnel.invitesActivated}
            sub={`${fmtPct(funnel.activationRate)} activation rate`}
          />
          <FunnelRow label="Expiradas" value={funnel.invitesExpired} bad={funnel.invitesExpired > 0} />
          <FunnelRow label="Failed" value={funnel.invitesFailed} bad={funnel.invitesFailed > 0} />
        </div>
      </Card>
      <Card title="Top organizaciones" isMobile={isMobile}>
        <Table
          headers={["Org", "Pools", "Activación"]}
          rows={orgs.slice(0, 8).map((o) => [
            o.name,
            fmtInt(o.poolCount),
            `${fmtInt(o.invitesActivated)}/${fmtInt(o.invitesTotal)} (${fmtPct(o.activationRate)})`,
          ])}
        />
      </Card>
      <Card title="Inquiries recientes" isMobile={isMobile} span={2}>
        <Table
          headers={["Fecha", "Empresa", "País", "Pools", "Slots/pool", "Estado", "Lag respuesta"]}
          rows={inquiries.slice(0, 12).map((i) => [
            new Date(i.createdAtUtc).toLocaleDateString("es-CO"),
            i.companyName,
            i.country ?? "—",
            i.numberOfPools ?? "—",
            i.slotsPerPool ?? "—",
            i.responded ? "✓ Respondida" : "⏳ Pendiente",
            i.responseLagHours != null ? `${i.responseLagHours.toFixed(1)}h` : "—",
          ])}
        />
      </Card>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  sub,
  bad,
}: {
  label: string;
  value: number;
  sub?: string;
  bad?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.sm,
        background: bad ? colors.errorBg : colors.bgLight,
        borderRadius: radii.md,
        fontSize: fontSize.sm,
      }}
    >
      <span style={{ color: colors.textDark }}>{label}</span>
      <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.lg, color: bad ? colors.errorDark : colors.text }}>
        {fmtInt(value)}
        {sub && (
          <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.normal, color: colors.textMuted, marginLeft: 6 }}>
            · {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function RevenueSection({
  weekly,
  payment,
  totalUsd,
  totalCop,
  isMobile,
}: {
  weekly: AnalyticsDashboardResponse["revenueByWeek"];
  payment: AnalyticsDashboardResponse["paymentBreakdown"];
  totalUsd: number;
  totalCop: number;
  isMobile: boolean;
}) {
  // Convert USD cents to dollars for chart readability
  const chartData = weekly.map((w) => ({
    weekStart: w.weekStart,
    usd: (w.revenueUsdMinor ?? 0) / 100,
    cop: w.revenueCop ?? 0,
    paymentCount: w.paidPaymentsCount,
  }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Revenue por semana" subtitle="USD pagado por semana" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => fmtUsd(Number(v) * 100)}
            />
            <Bar dataKey="usd" fill={PALETTE.success} name="USD" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Revenue por semana (COP)" isMobile={isMobile}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
            <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmtCop(Number(v))} />
            <Bar dataKey="cop" fill={PALETTE.warning} name="COP" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Conversión de checkouts" isMobile={isMobile}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <FunnelRow label="Iniciados" value={payment.totalCheckoutsStarted} />
          <FunnelRow
            label="Completados"
            value={payment.totalCheckoutsCompleted}
            sub={`${fmtPct(payment.conversionRate)} conv`}
          />
          <FunnelRow
            label="Failed"
            value={payment.totalCheckoutsFailed}
            bad={payment.totalCheckoutsFailed > 0}
          />
          <FunnelRow
            label="Abandonados (>24h en PENDING)"
            value={payment.staleAbandonedCount}
            bad={payment.staleAbandonedCount > 0}
            sub="usuarios que iniciaron pero nunca pagaron"
          />
          <div style={{ marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 1.6 }}>
            Avg pago USD: {fmtUsd(payment.avgPaymentUsd)} · Avg pago COP: {fmtCop(payment.avgPaymentCop)}
            {payment.avgTimeToPaymentMinutes !== null && (
              <>
                <br/>
                Tiempo medio checkout → pago: {payment.avgTimeToPaymentMinutes < 60
                  ? `${Math.round(payment.avgTimeToPaymentMinutes)} min`
                  : `${(payment.avgTimeToPaymentMinutes / 60).toFixed(1)} h`}
              </>
            )}
          </div>
        </div>
      </Card>
      <Card title="Por proveedor & tier" isMobile={isMobile}>
        <Table
          headers={["Proveedor", "Pagos", "Revenue"]}
          rows={payment.byProvider.map((p) => [
            p.provider,
            fmtInt(p.count),
            p.provider === "polar" ? fmtUsd(p.revenueLocalUnits) : fmtCop(p.revenueLocalUnits),
          ])}
        />
        <div style={{ marginTop: spacing.md }}>
          <Table
            headers={["From → To", "Pagos"]}
            rows={payment.byTier.slice(0, 5).map((t) => [
              `${t.fromCapacity} → ${t.toCapacity}`,
              fmtInt(t.count),
            ])}
          />
        </div>
      </Card>
    </div>
  );
}

function AcquisitionSection({
  topAcquisition,
  acquisitionFunnel,
  referrals,
  isMobile,
}: {
  topAcquisition: AnalyticsDashboardResponse["topAcquisition"];
  acquisitionFunnel: AnalyticsDashboardResponse["acquisitionFunnel"];
  referrals: AnalyticsDashboardResponse["organicReferrals"];
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Top UTM (source × medium)" isMobile={isMobile}>
        <Table
          headers={["Source", "Medium", "Usuarios"]}
          rows={topAcquisition.map((a) => [a.source, a.medium, fmtInt(a.count)])}
        />
      </Card>
      <Card title={`Referidos orgánicos (${fmtInt(referrals.totalReferred)} total)`} isMobile={isMobile}>
        <Table
          headers={["Usuario", "Refirió a"]}
          rows={referrals.topReferrers.map((r) => [r.displayName, fmtInt(r.referralCount)])}
        />
      </Card>
      <Card title="Funnel por canal" subtitle="Cuál convierte mejor: signups → pool joined → made pick" isMobile={isMobile} span={2}>
        <Table
          headers={["Source × Medium", "Signups", "Joined", "Picked", "Pick rate"]}
          rows={acquisitionFunnel.map((a) => [
            <span key="ch" style={{ fontWeight: fontWeight.semibold }}>
              {a.source} <span style={{ color: colors.textMuted }}>×</span> {a.medium}
            </span>,
            fmtInt(a.signups),
            fmtInt(a.joinedPool),
            fmtInt(a.madePick),
            <span
              key="r"
              style={{
                color: a.pickRate >= 0.3 ? PALETTE.success : a.pickRate >= 0.1 ? PALETTE.warning : PALETTE.error,
                fontWeight: fontWeight.semibold,
              }}
            >
              {fmtPct(a.pickRate)}
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}

function CohortActivationSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["cohortActivation"];
  isMobile: boolean;
}) {
  // The picked-within-14d rate is the single most actionable metric: it
  // tells you whether the cohort that just signed up is finding its way
  // to a pick. We render it boldly + colour-code the percentage.
  const formatRate = (rate: number, inProgress: boolean): React.ReactNode => {
    if (inProgress) return <span style={{ color: colors.textMuted }}>⏳ en curso</span>;
    return (
      <span
        style={{
          color: rate >= 0.4 ? PALETTE.success : rate >= 0.15 ? PALETTE.warning : PALETTE.error,
          fontWeight: fontWeight.semibold,
        }}
      >
        {fmtPct(rate)}
      </span>
    );
  };
  return (
    <Card isMobile={isMobile}>
      <Table
        headers={[
          "Cohorte (semana)",
          "Tamaño",
          "Joined ≤14d",
          "% joined",
          "Picked ≤14d",
          "% activated",
        ]}
        rows={data.map((c) => [
          c.cohortWeekStart,
          fmtInt(c.cohortSize),
          fmtInt(c.joinedWithin2w),
          formatRate(c.joinedRate, c.inProgress),
          fmtInt(c.pickedWithin2w),
          formatRate(c.pickedRate, c.inProgress),
        ])}
      />
    </Card>
  );
}

function EngagementSignalsSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["engagementSignals"];
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Top jugadores (últimos 30 días)" subtitle="Más picks hechos en cualquier tipo de pool" isMobile={isMobile}>
        {data.topPlayers30d.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted, padding: spacing.lg, textAlign: "center" }}>
            Sin picks en 30 días.
          </div>
        ) : (
          <Table
            headers={["Jugador", "Picks", "Pools"]}
            rows={data.topPlayers30d.map((p) => [
              p.displayName,
              fmtInt(p.pickCount),
              fmtInt(p.poolCount),
            ])}
          />
        )}
      </Card>

      <Card title="Top hosts" subtitle="Por miembros activos acumulados en sus pools" isMobile={isMobile}>
        {data.topHosts.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted, padding: spacing.lg, textAlign: "center" }}>
            Sin hosts con miembros activos.
          </div>
        ) : (
          <Table
            headers={["Host", "Pools creadas", "Activas", "Miembros activos"]}
            rows={data.topHosts.map((h) => [
              h.displayName,
              fmtInt(h.poolsCreated),
              fmtInt(h.activePools),
              fmtInt(h.totalActiveMembers),
            ])}
          />
        )}
      </Card>

      <Card
        title="Engagement por torneo"
        subtitle="Pools, miembros activos, picks totales y jugadores únicos"
        isMobile={isMobile}
        span={2}
      >
        {data.tournamentEngagement.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted, padding: spacing.lg, textAlign: "center" }}>
            Sin torneos con datos.
          </div>
        ) : (
          <Table
            headers={["Torneo", "Pools", "Miembros activos", "Picks", "Jugadores únicos"]}
            rows={data.tournamentEngagement.map((t) => [
              <span key="n" style={{ fontWeight: fontWeight.semibold }}>
                {t.tournamentName}
                {t.templateKey && (
                  <span style={{ color: colors.textLight, fontWeight: fontWeight.normal, marginLeft: 8, fontSize: fontSize.xs }}>
                    {t.templateKey}
                  </span>
                )}
              </span>,
              fmtInt(t.poolCount),
              fmtInt(t.totalActiveMembers),
              fmtInt(t.totalPicks),
              fmtInt(t.uniquePickers),
            ])}
          />
        )}
      </Card>
    </div>
  );
}

function CommunicationsSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["communicationsHealth"];
  isMobile: boolean;
}) {
  // Stack feedback into a chart-friendly shape; recharts wants the
  // category columns flat at the top level of each datum.
  const totalSuppressions7d = data.emailSuppressionsByWeek
    .slice(-1)
    .reduce((s, w) => s + w.count, 0);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Tasa de completación del modal" subtitle="Usuarios que han elegido idioma vs total" isMobile={isMobile}>
        <div
          style={{
            fontSize: fontSize["4xl"],
            fontWeight: fontWeight.extrabold,
            color:
              data.localePromptCompletionRate >= 0.5
                ? PALETTE.success
                : data.localePromptCompletionRate >= 0.2
                  ? PALETTE.warning
                  : PALETTE.error,
            lineHeight: 1.1,
          }}
        >
          {fmtPct(data.localePromptCompletionRate)}
        </div>
        <div style={{ marginTop: spacing.sm, fontSize: fontSize.xs, color: colors.textMuted }}>
          {data.localePromptCompletionsDaily.length === 0
            ? "Aún no hay completaciones registradas en 30 días."
            : `${fmtInt(data.localePromptCompletionsDaily.reduce((s, d) => s + d.count, 0))} usuarios completaron el modal en los últimos 30 días.`}
        </div>
      </Card>

      <Card title="Completaciones del modal por día" subtitle="Últimos 30 días" isMobile={isMobile}>
        {data.localePromptCompletionsDaily.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted, padding: spacing.lg, textAlign: "center" }}>
            Aún no hay datos.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.localePromptCompletionsDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={PALETTE.primary} name="Completaciones" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        title="Email suppressions por semana"
        subtitle={
          totalSuppressions7d > 5
            ? "⚠ Spike detectado — revisar deliverability"
            : "Bounces + complaints (Resend)"
        }
        isMobile={isMobile}
      >
        {data.emailSuppressionsByWeek.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: PALETTE.success, padding: spacing.lg, textAlign: "center" }}>
            ✓ Cero suppressions en 12 semanas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.emailSuppressionsByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
              <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={PALETTE.error} name="Suppressions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Feedback por semana" subtitle="BUG · FEATURE · OTROS, últimas 12 semanas" isMobile={isMobile}>
        {data.feedbackByWeek.length === 0 ? (
          <div style={{ fontSize: fontSize.sm, color: colors.textMuted, padding: spacing.lg, textAlign: "center" }}>
            Sin feedback en 12 semanas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.feedbackByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
              <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="bug" stackId="fb" fill={PALETTE.error} name="Bug" />
              <Bar dataKey="feature" stackId="fb" fill={PALETTE.info} name="Feature" />
              <Bar dataKey="other" stackId="fb" fill={PALETTE.muted} name="Otros" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function CohortSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["cohortRetention"];
  isMobile: boolean;
}) {
  // Renders "en curso" for buckets whose measurement window has not closed
  // for that cohort — a 5-day-old cohort cannot have W1 retention yet, so
  // showing "0 (0%)" would mislead. The backend marks each bucket with an
  // `inProgressW*` boolean.
  const formatCell = (
    inProgress: boolean,
    retained: number,
    cohortSize: number,
  ): string => {
    if (inProgress) return "⏳ en curso";
    if (cohortSize === 0) return "—";
    const pct = retained / cohortSize;
    return `${fmtInt(retained)} (${fmtPct(pct)})`;
  };

  return (
    <Card isMobile={isMobile}>
      <Table
        headers={["Cohorte (semana)", "Tamaño", "W1 retornaron", "W2 retornaron", "W4 retornaron"]}
        rows={data.map((c) => [
          c.cohortWeekStart,
          fmtInt(c.cohortSize),
          formatCell(c.inProgressW1, c.retainedW1, c.cohortSize),
          formatCell(c.inProgressW2, c.retainedW2, c.cohortSize),
          formatCell(c.inProgressW4, c.retainedW4, c.cohortSize),
        ])}
      />
    </Card>
  );
}

// ─── Locale distribution (post first-login modal) ───────────

function LocaleDistributionSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["localeDistribution"];
  isMobile: boolean;
}) {
  // Labels map. "pending" is special — those users haven't answered the
  // first-login modal yet. Helps the team gauge modal completion velocity.
  const LABELS: Record<string, { name: string; color: string }> = {
    es: { name: "Español", color: PALETTE.primary },
    en: { name: "English", color: PALETTE.info },
    pt: { name: "Português", color: PALETTE.success },
    pending: { name: "Pendiente (modal sin completar)", color: PALETTE.warning },
  };

  const total = data.reduce((s, r) => s + r.count, 0);
  const completed = data.filter((r) => r.locale !== "pending").reduce((s, r) => s + r.count, 0);
  const completionRate = total > 0 ? completed / total : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 2fr) minmax(0, 1fr)",
        gap: spacing.md,
      }}
    >
      <Card title="Idioma elegido por usuarios" isMobile={isMobile}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {data.map((row) => {
            const meta = LABELS[row.locale] ?? { name: row.locale, color: colors.textMuted };
            return (
              <div key={row.locale}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: fontSize.sm,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: fontWeight.semibold }}>{meta.name}</span>
                  <span style={{ color: colors.textMuted }}>
                    {fmtInt(row.count)} ({fmtPct(row.pct)})
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    background: colors.borderLight,
                    borderRadius: radii.pill,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${row.pct * 100}%`,
                      height: "100%",
                      background: meta.color,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Modal de primer login" isMobile={isMobile}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <div>
            <div style={{ fontSize: fontSize.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Tasa de completación
            </div>
            <div
              style={{
                fontSize: fontSize["3xl"],
                fontWeight: fontWeight.extrabold,
                color: completionRate >= 0.5 ? PALETTE.success : PALETTE.warning,
              }}
            >
              {fmtPct(completionRate)}
            </div>
            <div style={{ fontSize: fontSize.xs, color: colors.textLight }}>
              {fmtInt(completed)} de {fmtInt(total)} usuarios respondieron
            </div>
          </div>
          {completionRate < 1 && (
            <div
              style={{
                marginTop: spacing.sm,
                padding: spacing.sm,
                borderRadius: radii.md,
                background: `${PALETTE.warning}10`,
                borderLeft: `3px solid ${PALETTE.warning}`,
                fontSize: fontSize.xs,
                color: colors.textMuted,
                lineHeight: 1.5,
              }}
            >
              Los usuarios pendientes verán el modal en su próximo login. Hasta entonces, sus correos siguen la cascada por país (default español).
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function OperationalSection({
  data,
  isMobile,
}: {
  data: AnalyticsDashboardResponse["operationalHealth"];
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
        gap: spacing.md,
      }}
    >
      <Card title="Email suppressions" isMobile={isMobile}>
        <div style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.bold, color: colors.text }}>
          {fmtInt(data.emailSuppressions)}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
          emails marcados como bounce / unsubscribe
        </div>
      </Card>
      <Card title="Failed analytics events" isMobile={isMobile}>
        <div
          style={{
            fontSize: fontSize["3xl"],
            fontWeight: fontWeight.bold,
            color: data.failedAnalyticsEvents > 0 ? colors.error : colors.text,
          }}
        >
          {fmtInt(data.failedAnalyticsEvents)}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
          DLQ pendientes (Meta CAPI / GA4 MP)
        </div>
      </Card>
      <Card title="Audit events últimas 24h" isMobile={isMobile}>
        <div style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.bold, color: colors.text }}>
          {fmtInt(data.auditEventsLast24h)}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
          rate aprox: {(data.auditEventsLast24h / 24).toFixed(1)} eventos/h
        </div>
      </Card>
      <Card title="Feedback reciente" isMobile={isMobile} span={3}>
        <Table
          headers={["Fecha", "Tipo", "Mensaje"]}
          rows={data.recentFeedback.map((f) => [
            fmtRelativeTime(f.createdAtUtc),
            f.type,
            f.message.length > 100 ? f.message.slice(0, 100) + "…" : f.message,
          ])}
        />
      </Card>
    </div>
  );
}

// ─── Generic table ──────────────────────────────────────────

function Table({
  headers,
  rows,
}: {
  headers: string[];
  // Allow ReactNode so cells can carry inline emphasis (coloured pct
  // chips, badges) instead of being limited to flat strings/numbers.
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: spacing.md, textAlign: "center", color: colors.textLight, fontSize: fontSize.sm }}>
        Sin datos
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fontSize.sm }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: `1px solid ${colors.bgLight}` }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    color: colors.textDark,
                    whiteSpace: "nowrap",
                  }}
                >
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
