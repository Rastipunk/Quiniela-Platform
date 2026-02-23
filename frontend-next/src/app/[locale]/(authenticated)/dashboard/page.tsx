"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import {
  createPool,
  getMePools,
  joinPool,
  listCatalogInstances,
  type CatalogInstance,
  type MePoolRow,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { PoolConfigWizard } from "@/components/PoolConfigWizard";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { TOURNAMENT_CATALOG } from "@/lib/tournamentCatalog";

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
  } catch {
    return "America/Bogota";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("dashboard");
  const tc = useTranslations("landing.tournaments");

  function getPoolStatusBadge(status: string): { label: string; color: string; emoji: string } {
    const labels: Record<string, { color: string; emoji: string }> = {
      DRAFT: { color: "#f59e0b", emoji: "\u{1F4DD}" },
      ACTIVE: { color: "#10b981", emoji: "\u26BD" },
      COMPLETED: { color: "#3b82f6", emoji: "\u{1F3C6}" },
      ARCHIVED: { color: "#6b7280", emoji: "\u{1F4E6}" },
    };
    const info = labels[status] ?? { color: "#9ca3af", emoji: "\u2753" };
    const label = t(`status.${status}` as any) ?? t("status.UNKNOWN");
    return { label, ...info };
  }

  const token = useMemo(() => getToken(), []);

  const [rows, setRows] = useState<MePoolRow[] | null>(null);
  const [instances, setInstances] = useState<CatalogInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [panel, setPanel] = useState<"NONE" | "CREATE" | "JOIN">("NONE");
  const [showWizard, setShowWizard] = useState(false);

  // Create form
  const [instanceId, setInstanceId] = useState<string>("");
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [deadline, setDeadline] = useState<number>(10);
  const [timeZone, setTimeZone] = useState<string>(detectTz());
  const [requireApproval, setRequireApproval] = useState<boolean>(false);
  const [pickTypesConfig, setPickTypesConfig] = useState<PoolPickTypesConfig | string | null>(null);

  // Join form
  const [inviteCode, setInviteCode] = useState("");

  const [busy, setBusy] = useState(false);

  async function loadAll() {
    if (!token) return;
    setError(null);
    try {
      const [pools, inst] = await Promise.all([getMePools(token), listCatalogInstances(token)]);
      setRows(pools);
      setInstances(inst);

      // default instance selection
      if (!instanceId && inst.length) setInstanceId(inst[0].id);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!token) return;
    if (!instanceId) return setError(t("errors.selectInstance"));
    if (poolName.trim().length < 3) return setError(t("errors.poolNameMin"));
    if (!pickTypesConfig) return setError(t("errors.configRequired"));

    setBusy(true);
    setError(null);

    try {
      const created = await createPool(token, {
        tournamentInstanceId: instanceId,
        name: poolName.trim(),
        description: poolDesc.trim() ? poolDesc.trim() : undefined,
        timeZone,
        deadlineMinutesBeforeKickoff: deadline,
        pickTypesConfig: pickTypesConfig,
        requireApproval,
      });

      setPanel("NONE");
      setShowWizard(false);
      setPickTypesConfig(null);
      await loadAll();
      router.push(`/pools/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!token) return;
    if (!inviteCode.trim()) return setError(t("errors.inviteCodeRequired"));

    setBusy(true);
    setError(null);

    try {
      const res = await joinPool(token, inviteCode.trim());
      setPanel("NONE");
      await loadAll();

      // Si el join requiere aprobación, mostrar mensaje y NO navegar al pool
      if (res.status === "PENDING_APPROVAL") {
        alert(`\u2705 ${t("joinApproval.alertTitle")}\n\n${res.message}\n\n${t("joinApproval.alertMessage")}`);
        // No navegar, solo recargar para mostrar el pool pendiente
      } else {
        // Join directo aprobado, navegar al pool
        router.push(`/pools/${res.poolId}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  // Estilos responsivos
  const inputStyle = {
    padding: isMobile ? 14 : 10,
    fontSize: isMobile ? 16 : 14,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
    boxSizing: "border-box" as const,
    ...mobileInteractiveStyles.tapHighlight,
  };

  const buttonStyle = {
    padding: isMobile ? "14px 16px" : "10px 12px",
    borderRadius: 10,
    fontSize: isMobile ? 15 : 14,
    fontWeight: 500,
    minHeight: TOUCH_TARGET.minimum,
    cursor: "pointer",
    ...mobileInteractiveStyles.tapHighlight,
  };

  return (
    <div style={{ maxWidth: 980, margin: isMobile ? "0 auto" : "24px auto", padding: isMobile ? 16 : 16 }}>
      <header
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 24 }}>{t("title")}</h2>
          <div style={{ color: "#666", fontSize: isMobile ? 13 : 12 }}>
            {t("subtitle")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: isMobile ? 12 : 0,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <button onClick={() => setPanel("CREATE")} style={buttonStyle}>
            {t("createPool")}
          </button>
          <button onClick={() => setPanel("JOIN")} style={buttonStyle}>
            {t("joinWithCode")}
          </button>
          {!isMobile && (
            <button
              onClick={() => {
                clearToken();
                window.location.href = "/";
              }}
              style={buttonStyle}
            >
              {t("logout")}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fee",
            border: "1px solid #fbb",
            fontSize: isMobile ? 14 : 13,
          }}
        >
          {error}
        </div>
      )}

      {!rows && !error && <p style={{ marginTop: 18 }}>{t("loading")}</p>}

      {rows && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.poolId}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: isMobile ? 16 : 14,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: isMobile ? "stretch" : "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  {/* Pool Name + Badges */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: isMobile ? 17 : 16 }}>{r.pool.name}</div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid #ddd",
                        background: r.role === "HOST" ? "#111" : "#fff",
                        color: r.role === "HOST" ? "#fff" : "#111",
                      }}
                    >
                      {r.role}
                    </span>
                    {r.status === "PENDING_APPROVAL" && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          border: "1px solid #ffc107",
                          background: "#fff3cd",
                          color: "#856404",
                          fontWeight: 600,
                        }}
                      >
                        {"\u23F3"} {t("pendingBadge")}
                      </span>
                    )}
                    {r.pool.status && (() => {
                      const badge = getPoolStatusBadge(r.pool.status);
                      return (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: `1px solid ${badge.color}`,
                            background: `${badge.color}20`,
                            color: badge.color,
                            fontWeight: 600,
                          }}
                        >
                          {badge.emoji} {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Meta info */}
                  <div style={{ color: "#666", fontSize: isMobile ? 13 : 12, marginTop: 4 }}>
                    {t("poolCard.timezone")}: {r.pool.timeZone} {"\u2022"} {t("poolCard.deadline")}: {r.pool.deadlineMinutesBeforeKickoff}m
                  </div>

                  {r.tournamentInstance && (
                    <div style={{ marginTop: 6, color: "#666", fontSize: isMobile ? 13 : 12 }}>
                      {t("poolCard.tournament")}: {r.tournamentInstance.name}
                    </div>
                  )}
                </div>

                {/* Action */}
                {r.status === "PENDING_APPROVAL" ? (
                  <span
                    style={{
                      color: "#999",
                      fontSize: 14,
                      fontStyle: "italic",
                      padding: isMobile ? "12px 0" : 0,
                      textAlign: isMobile ? "center" : "left",
                    }}
                  >
                    {t("waitingApproval")}
                  </span>
                ) : (
                  <Link
                    href={{ pathname: "/pools/[poolId]", params: { poolId: r.poolId } }}
                    style={{
                      textDecoration: "none",
                      padding: isMobile ? 14 : 8,
                      background: "#007bff",
                      color: "#fff",
                      borderRadius: 8,
                      fontWeight: 600,
                      textAlign: "center",
                      minHeight: isMobile ? TOUCH_TARGET.minimum : "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {t("openPool")}
                  </Link>
                )}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div
              style={{
                padding: isMobile ? 24 : 14,
                border: "1px dashed #ccc",
                borderRadius: 14,
                color: "#666",
                textAlign: "center",
                fontSize: isMobile ? 15 : 14,
              }}
            >
              {t("emptyState")}
            </div>
          )}
        </div>
      )}

      {/* Panel Modal */}
      {panel !== "NONE" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? 0 : 16,
            zIndex: 1000,
          }}
          onClick={() => setPanel("NONE")}
        >
          <div
            style={{
              width: isMobile ? "100%" : "min(720px, 100%)",
              maxHeight: isMobile ? "90vh" : "85vh",
              background: "#fff",
              borderRadius: isMobile ? "16px 16px 0 0" : 16,
              padding: isMobile ? 20 : 16,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 18 }}>
                {panel === "CREATE" ? t("createPanel.title") : t("joinPanel.title")}
              </div>
              <button
                onClick={() => setPanel("NONE")}
                style={{
                  width: TOUCH_TARGET.minimum,
                  height: TOUCH_TARGET.minimum,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f5f5f5",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 18,
                  color: "#666",
                  cursor: "pointer",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
                aria-label="Close"
              >
                &#10005;
              </button>
            </div>

            {panel === "CREATE" && !showWizard && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.tournamentLabel")}</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 8,
                    }}
                  >
                    {TOURNAMENT_CATALOG.map((tournament) => {
                      const matchingInstance = (instances ?? []).find(
                        (inst) => inst.template?.key === tournament.templateKey
                      );
                      const isAvailable = tournament.active && !!matchingInstance;
                      const isSelected = isAvailable && instanceId === matchingInstance?.id;

                      return (
                        <button
                          key={tournament.key}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => {
                            if (matchingInstance) setInstanceId(matchingInstance.id);
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            padding: "12px 8px",
                            borderRadius: 10,
                            border: isSelected
                              ? "2px solid #667eea"
                              : "1px solid #e5e7eb",
                            background: isSelected
                              ? "linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08))"
                              : isAvailable
                                ? "#fff"
                                : "#f9fafb",
                            cursor: isAvailable ? "pointer" : "default",
                            opacity: isAvailable ? 1 : 0.45,
                            filter: isAvailable ? "none" : "grayscale(100%)",
                            transition: "border-color 0.15s, background 0.15s",
                            position: "relative",
                          }}
                        >
                          {!isAvailable && (
                            <span
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                fontSize: "0.55rem",
                                fontWeight: 600,
                                color: "#fff",
                                background: "#9ca3af",
                                padding: "1px 4px",
                                borderRadius: 3,
                                textTransform: "uppercase",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {tc("comingSoon")}
                            </span>
                          )}
                          <span style={{ fontSize: "1.5rem" }}>{tournament.emoji}</span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              color: isAvailable ? "#111827" : "#9ca3af",
                              textAlign: "center",
                              lineHeight: 1.2,
                            }}
                          >
                            {tc(`items.${tournament.i18nKey}.name`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.poolNameLabel")}</span>
                  <input
                    value={poolName}
                    onChange={(e) => setPoolName(e.target.value)}
                    placeholder={t("createPanel.poolNamePlaceholder")}
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.descriptionLabel")}</span>
                  <input
                    value={poolDesc}
                    onChange={(e) => setPoolDesc(e.target.value)}
                    placeholder={t("createPanel.descriptionPlaceholder")}
                    style={inputStyle}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>
                      {t("createPanel.deadlineLabel")}
                    </span>
                    <input
                      type="number"
                      value={deadline}
                      min={0}
                      max={1440}
                      onChange={(e) => setDeadline(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("createPanel.timezoneLabel")}</span>
                    <input
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      placeholder="America/Bogota"
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 6,
                    padding: 12,
                    background: "#f8f9fa",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                    style={{ width: 20, height: 20, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>
                      {t("createPanel.requireApprovalLabel")}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      {t("createPanel.requireApprovalDesc")}
                    </div>
                  </div>
                </label>

                {/* Scoring Configuration */}
                <div
                  style={{
                    marginTop: 8,
                    padding: 16,
                    border: "2px solid #007bff",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                    {"\u{1F4CA}"} {t("createPanel.scoringTitle")}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.95 }}>
                    {t("createPanel.scoringDesc")}
                  </div>
                  <button
                    onClick={() => setShowWizard(true)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: "2px solid white",
                      background: "white",
                      color: "#667eea",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      minHeight: TOUCH_TARGET.minimum,
                      ...mobileInteractiveStyles.tapHighlight,
                    }}
                  >
                    {"\u{1F9D9}\u200D\u2642\uFE0F"} {t("createPanel.configWizard")}
                  </button>
                  {pickTypesConfig && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 10,
                        background: "rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {"\u2705"} {t("createPanel.configReady", { count: (pickTypesConfig as any[]).length })}
                    </div>
                  )}
                </div>

                <button
                  onClick={onCreate}
                  disabled={busy}
                  style={{
                    marginTop: 8,
                    padding: isMobile ? 16 : 12,
                    borderRadius: 12,
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: isMobile ? 16 : 14,
                    fontWeight: 600,
                    minHeight: TOUCH_TARGET.comfortable,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {busy ? t("createPanel.creating") : t("createPanel.createButton")}
                </button>
              </div>
            )}

            {/* Advanced Configuration Wizard */}
            {panel === "CREATE" && showWizard && instanceId && token && (
              <div>
                <PoolConfigWizard
                  instanceId={instanceId}
                  token={token}
                  onComplete={(config) => {
                    setPickTypesConfig(config);
                    setShowWizard(false);
                  }}
                  onCancel={() => setShowWizard(false)}
                />
              </div>
            )}

            {panel === "JOIN" && (
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#444", fontWeight: 500 }}>{t("joinPanel.inviteCodeLabel")}</span>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder={t("joinPanel.inviteCodePlaceholder")}
                    style={inputStyle}
                  />
                </label>

                <button
                  onClick={onJoin}
                  disabled={busy}
                  style={{
                    marginTop: 6,
                    padding: isMobile ? 16 : 12,
                    borderRadius: 12,
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: isMobile ? 16 : 14,
                    fontWeight: 600,
                    minHeight: TOUCH_TARGET.comfortable,
                    ...mobileInteractiveStyles.tapHighlight,
                  }}
                >
                  {busy ? t("joinPanel.joining") : t("joinPanel.joinButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
