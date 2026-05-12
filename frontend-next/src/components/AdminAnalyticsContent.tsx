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

import { useEffect, useMemo, useRef, useState } from "react";
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
  type AnalyticsDashboardResponse,
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

// ─── Polling intervals ──────────────────────────────────────

const REFRESH_INTERVALS_MS: { label: string; ms: number | null }[] = [
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1min", ms: 60_000 },
  { label: "5min", ms: 300_000 },
  { label: "Off", ms: null },
];
const DEFAULT_REFRESH_INDEX = 1; // 30s

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
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(DEFAULT_REFRESH_INDEX);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [forcedRefreshing, setForcedRefreshing] = useState(false);
  const fetchSeqRef = useRef(0);

  // ── Fetch ───────────────────────────────────────────────

  async function fetchDashboard(force = false) {
    const seq = ++fetchSeqRef.current;
    if (force) setForcedRefreshing(true);
    try {
      const result = await getAdminAnalyticsDashboard(force);
      // Stale-fetch guard: if a newer fetch already returned, drop this one
      if (seq !== fetchSeqRef.current) return;
      setData(result);
      setError(null);
      setAccessDenied(false);
      setLastFetchAt(new Date());
    } catch (err: any) {
      if (err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err.message ?? "Error cargando analítica");
      }
    } finally {
      setLoading(false);
      if (force) setForcedRefreshing(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh polling
  useEffect(() => {
    const ms = REFRESH_INTERVALS_MS[refreshIndex]?.ms;
    if (!ms) return;
    const id = setInterval(() => {
      fetchDashboard(false);
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshIndex]);

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

  // ─────────────────────────────────────────────────────────

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
        forcedRefreshing={forcedRefreshing}
        onRefresh={() => fetchDashboard(true)}
        refreshIndex={refreshIndex}
        onChangeRefresh={setRefreshIndex}
        isMobile={isMobile}
      />

      {/* Section errors banner */}
      {data.errors && data.errors.length > 0 && (
        <SectionErrorsBanner errors={data.errors} />
      )}

      {/* Top-line KPIs (with WoW deltas where deltable) */}
      <TopLineSection topLine={data.topLine} weekAgo={data.topLineWeekAgo} isMobile={isMobile} />

      {/* Locale distribution (post-modal split + completion rate) */}
      <Section title="🌐 Distribución de idioma" subtitle="Idioma elegido en el modal de primer login + cuántos siguen pendientes">
        <LocaleDistributionSection data={data.localeDistribution} isMobile={isMobile} />
      </Section>

      {/* User growth */}
      <Section title="📈 Crecimiento de usuarios" subtitle="Signups por semana, últimas 12 semanas">
        <SignupsChart data={data.signupsByWeek} isMobile={isMobile} />
      </Section>

      {/* Pool growth */}
      <Section title="🏆 Crecimiento de pools" subtitle="Pools creadas por semana, split personal vs corporativo">
        <PoolsChart data={data.poolsByWeek} isMobile={isMobile} />
      </Section>

      {/* Engagement: DAU + funnel */}
      <Section title="🎯 Engagement" subtitle="Usuarios activos, picks por semana, funnel de activación">
        <EngagementSection
          dailyActive={data.dailyActiveUsers}
          picksByWeek={data.picksByWeek}
          funnel={data.funnel}
          isMobile={isMobile}
        />
      </Section>

      {/* Geography */}
      <Section title="🌎 Geografía" subtitle="Top 20 países por número de usuarios">
        <GeographySection data={data.usersByCountry} isMobile={isMobile} />
      </Section>

      {/* Pool health */}
      <Section title="🩺 Salud de pools" subtitle="Status, tamaño, alertas">
        <PoolHealthSection
          byStatus={data.poolsByStatus}
          sizes={data.poolSizeDistribution}
          health={data.poolHealth}
          tournaments={data.poolsByTournament}
          isMobile={isMobile}
        />
      </Section>

      {/* Corporate funnel */}
      <Section title="🏢 Funnel corporativo" subtitle="Inquiries → activaciones">
        <CorporateSection
          funnel={data.corporateFunnel}
          orgs={data.topOrganizations}
          inquiries={data.recentInquiries}
          isMobile={isMobile}
        />
      </Section>

      {/* Revenue */}
      <Section title="💰 Revenue" subtitle="Pagos completados por semana, breakdown por proveedor y tier">
        <RevenueSection
          weekly={data.revenueByWeek}
          payment={data.paymentBreakdown}
          totalUsd={data.topLine.totalRevenueUsd}
          totalCop={data.topLine.totalRevenueCop}
          isMobile={isMobile}
        />
      </Section>

      {/* Acquisition */}
      <Section title="📡 Adquisición" subtitle="Source / medium UTM, conversión por canal, referidos orgánicos">
        <AcquisitionSection
          topAcquisition={data.topAcquisition}
          acquisitionFunnel={data.acquisitionFunnel}
          referrals={data.organicReferrals}
          isMobile={isMobile}
        />
      </Section>

      {/* Cohort activation (signup → first pick within 14 days) */}
      <Section title="⚡ Activación por cohorte" subtitle="% de signups de cada semana que hicieron al menos un pick en sus primeros 14 días">
        <CohortActivationSection data={data.cohortActivation} isMobile={isMobile} />
      </Section>

      {/* Cohort retention */}
      <Section title="🔄 Retención por cohorte" subtitle="% de signups que volvieron a hacer un pick en W1, W2 y W4">
        <CohortSection data={data.cohortRetention} isMobile={isMobile} />
      </Section>

      {/* Operational */}
      <Section title="🔧 Salud operacional" subtitle="Errores, suppressions, feedback reciente">
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
  forcedRefreshing,
  onRefresh,
  refreshIndex,
  onChangeRefresh,
  isMobile,
}: {
  data: AnalyticsDashboardResponse;
  lastFetchAt: Date | null;
  forcedRefreshing: boolean;
  onRefresh: () => void;
  refreshIndex: number;
  onChangeRefresh: (i: number) => void;
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
          Generado {fmtRelativeTime(data.generatedAtUtc)}
          {lastFetchAt && ` · cargado ${fmtRelativeTime(lastFetchAt.toISOString())}`}
        </p>
      </div>

      <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: colors.bgLight,
            borderRadius: radii.lg,
          }}
        >
          {REFRESH_INTERVALS_MS.map((opt, idx) => {
            const active = idx === refreshIndex;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChangeRefresh(idx)}
                style={{
                  padding: "6px 12px",
                  borderRadius: radii.md,
                  border: "none",
                  background: active ? colors.white : "transparent",
                  color: active ? colors.text : colors.textMuted,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  cursor: "pointer",
                  boxShadow: active ? shadows.sm : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={forcedRefreshing}
          style={{
            padding: "8px 16px",
            borderRadius: radii.lg,
            border: `1px solid ${colors.brand}`,
            background: forcedRefreshing ? colors.disabled : colors.white,
            color: colors.brand,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: forcedRefreshing ? "wait" : "pointer",
          }}
        >
          {forcedRefreshing ? "⏳..." : "🔄 Refresh"}
        </button>
      </div>
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
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
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
