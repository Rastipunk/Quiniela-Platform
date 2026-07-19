"use client";

/**
 * Admin — Post-World-Cup survey results (ADR-089).
 *
 * Reads GET /admin/survey/summary and renders it as a live dashboard:
 * volumes, 1-10 averages, recommend buckets, host dimensions and the
 * testimonial bank (comments flagged with share consent). Refreshes on
 * mount, on demand, and every 60s while open. Spanish-only copy — the
 * admin panel convention (see AdminAnalyticsContent).
 */

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getAdminSurveySummary, type AdminSurveySummary } from "@/lib/api";
import { useIsMobile } from "@/hooks/useIsMobile";
import { colors, radii, spacing, fontSize, fontWeight, shadows } from "@/lib/theme";

const REFRESH_MS = 60_000;

function fmtAvg(n: number | null | undefined): string {
  return n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1);
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

// ── Small building blocks ────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radii.xl,
        padding: spacing.lg,
        boxShadow: shadows.sm,
      }}
    >
      <div style={{ fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold }}>
        {label}
      </div>
      <div
        style={{
          fontSize: fontSize["3xl"],
          fontWeight: fontWeight.extrabold,
          color: accent ?? colors.text,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ScoreBarRow({ label, value }: { label: string; value: number | null | undefined }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
      <div style={{ flex: "0 0 46%", fontSize: fontSize.sm, color: colors.text }}>{label}</div>
      <div
        style={{
          flex: 1,
          height: 10,
          background: colors.bgLight,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: colors.brandGradient,
            borderRadius: 999,
            transition: "width 300ms",
          }}
        />
      </div>
      <div
        style={{
          flex: "0 0 44px",
          textAlign: "right",
          fontWeight: fontWeight.bold,
          fontSize: fontSize.sm,
          color: colors.text,
        }}
      >
        {fmtAvg(value)}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: colors.white,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: radii.xl,
        padding: spacing.xl,
        boxShadow: shadows.sm,
      }}
    >
      <div
        style={{
          fontSize: fontSize.md,
          fontWeight: fontWeight.bold,
          color: colors.text,
          marginBottom: spacing.md,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: fontWeight.bold,
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────

export default function AdminSurveyContent() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<AdminSurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  async function fetchSummary() {
    try {
      const r = await getAdminSurveySummary();
      setData(r);
      setError(null);
      setAccessDenied(false);
      setLastFetchAt(new Date());
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 403 || status === 401) setAccessDenied(true);
      else setError((err as Error)?.message ?? "Error cargando la encuesta");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSummary();
    const id = setInterval(() => void fetchSummary(), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 720, margin: "60px auto", padding: spacing["3xl"], textAlign: "center" }}>
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

  if (loading && !data) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: spacing.xl }}>
        <h1 style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.extrabold }}>📝 Encuesta post-Mundial</h1>
        <p style={{ color: colors.textMuted }}>Cargando resultados…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: spacing.xl }}>
        <h1 style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.extrabold }}>📝 Encuesta post-Mundial</h1>
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

  const rec = data.recommend;
  const npsColor = rec.npsLike >= 30 ? colors.success : rec.npsLike >= 0 ? colors.warning : colors.error;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: isMobile ? spacing.md : spacing.xl,
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? spacing.lg : spacing.xl,
      }}
    >
      {/* Header */}
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
            }}
          >
            📝 Encuesta post-Mundial
          </h1>
          <p style={{ margin: `${spacing.xs}px 0 0`, color: colors.textMuted, fontSize: fontSize.sm }}>
            Resultados en vivo · se actualiza cada minuto
            {lastFetchAt && ` · actualizado ${fmtRelative(lastFetchAt.toISOString())}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchSummary()}
          style={{
            padding: "8px 16px",
            borderRadius: radii.lg,
            border: `1px solid ${colors.brand}`,
            background: colors.white,
            color: colors.brand,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: "pointer",
          }}
        >
          🔄 Actualizar
        </button>
      </div>

      {data.total === 0 ? (
        <Card title="Sin respuestas todavía">
          <p style={{ margin: 0, color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 1.6 }}>
            Aún no llega ninguna respuesta. Verifica que la ventana esté abierta
            (<code>SURVEY_OPENS_AT</code> / <code>SURVEY_CLOSES_AT</code>) y que{" "}
            <code>SURVEY_ALLOWLIST=*</code>. Esta página se refresca sola cada minuto.
          </p>
        </Card>
      ) : (
        <>
          {/* Volumes */}
          <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
            <StatTile label="Respuestas" value={data.total} accent={colors.brand} />
            <StatTile label="Jugadores" value={data.players} />
            <StatTile label="Hosts" value={data.hosts} />
            <StatTile label="Hosts corporativos" value={data.corporateHosts} />
          </div>

          {/* Core averages */}
          <Card title="Promedios generales (1–10)">
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <ScoreBarRow label="Experiencia en Picks4All" value={data.averages.overallScore} />
              <ScoreBarRow label="Probabilidad de recomendar" value={data.averages.recommendScore} />
              <ScoreBarRow label="Usaría la app en otros torneos" value={data.averages.otherTournamentsScore} />
            </div>
          </Card>

          {/* Recommend buckets */}
          <Card title="Recomendación">
            <div
              style={{
                display: "flex",
                gap: spacing.md,
                flexWrap: "wrap",
                alignItems: "stretch",
              }}
            >
              <StatTile label="Índice (promotores − detractores)" value={`${rec.npsLike > 0 ? "+" : ""}${rec.npsLike}`} accent={npsColor} />
              <StatTile label="Promotores (9–10)" value={rec.promoters} accent={colors.success} />
              <StatTile label="Pasivos (7–8)" value={rec.passives} accent={colors.warning} />
              <StatTile label="Detractores (1–6)" value={rec.detractors} accent={colors.error} />
            </div>
          </Card>

          {/* Host dimensions */}
          {data.hosts > 0 && (
            <Card title={`Dimensiones de host (1–10) · ${data.hosts} host${data.hosts === 1 ? "" : "s"}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
                <ScoreBarRow label="Facilidad para crear el pool" value={data.hostDimensionAverages.hostCreateScore} />
                <ScoreBarRow label="Facilidad para invitar jugadores" value={data.hostDimensionAverages.hostInviteScore} />
                <ScoreBarRow label="Resultados en vivo" value={data.hostDimensionAverages.hostLiveResultsScore} />
                <ScoreBarRow label="Claridad de las reglas" value={data.hostDimensionAverages.hostRulesScore} />
                <ScoreBarRow label="Soporte recibido" value={data.hostDimensionAverages.hostSupportScore} />
              </div>
            </Card>
          )}

          {/* Comments / testimonial bank */}
          <Card
            title={`Comentarios recientes · ${data.consent.shareableComments} citable${data.consent.shareableComments === 1 ? "" : "s"} como testimonio`}
          >
            {data.latestComments.length === 0 ? (
              <p style={{ margin: 0, color: colors.textMuted, fontSize: fontSize.sm }}>
                Todavía no hay comentarios escritos.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
                {data.latestComments.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: spacing.md,
                      background: c.shareConsent ? colors.successBgLight ?? "#f0fdf4" : colors.bgLight,
                      border: `1px solid ${c.shareConsent ? "#bbf7d0" : colors.borderLight}`,
                      borderRadius: radii.lg,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: spacing.sm,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: fontWeight.bold, fontSize: fontSize.sm, color: colors.text }}>
                        {c.user.displayName}
                      </span>
                      {c.isCorporateHost ? (
                        <Badge text="CORPORATE" bg="#ede9fe" fg="#6d28d9" />
                      ) : c.isHost ? (
                        <Badge text="HOST" bg="#fef3c7" fg="#b45309" />
                      ) : (
                        <Badge text="JUGADOR" bg="#e0f2fe" fg="#0369a1" />
                      )}
                      {c.shareConsent && <Badge text="✓ CITABLE" bg="#dcfce7" fg="#15803d" />}
                      <span style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                        {fmtRelative(c.createdAtUtc)}
                      </span>
                    </div>
                    <div style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {c.comment}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
