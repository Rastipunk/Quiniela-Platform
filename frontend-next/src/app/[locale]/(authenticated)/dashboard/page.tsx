"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createPool,
  getMePools,
  joinPool,
  leavePool,
  listCatalogInstances,
  type CatalogInstance,
  type MePoolRow,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { logout as apiLogout } from "@/lib/api";
import type { PoolPickTypesConfig } from "@/types/pickConfig";
import { useIsMobile, TOUCH_TARGET, mobileInteractiveStyles } from "@/hooks/useIsMobile";
import { colors, radii, fontSize as fs, fontWeight as fw } from "@/lib/theme";
import { PoolCard } from "./components/PoolCard";
import { LeavePoolModal } from "./components/LeavePoolModal";
import { CreateJoinPanel } from "./components/CreateJoinPanel";

function detectTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
  } catch {
    return "America/Bogota";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const t = useTranslations("dashboard");
  const tc = useTranslations("landing.tournaments");
  const te = useTranslations("enterprise");

  function getPoolStatusBadge(status: string): { label: string; color: string; emoji: string } {
    const labels: Record<string, { color: string; emoji: string }> = {
      DRAFT: { color: "#f59e0b", emoji: "\u{1F4DD}" },
      ACTIVE: { color: "#10b981", emoji: "\u26BD" },
      COMPLETED: { color: "#3b82f6", emoji: "\u{1F3C6}" },
      ARCHIVED: { color: "#6b7280", emoji: "\u{1F4E6}" },
    };
    const info = labels[status] ?? { color: "#9ca3af", emoji: "\u2753" };
    // next-intl doesn't support computed keys at type level
    const tDynamic = t as (key: string) => string;
    const label = tDynamic(`status.${status}`) ?? t("status.UNKNOWN");
    return { label, ...info };
  }

  const token = useMemo(() => getToken(), []);

  const [rows, setRows] = useState<MePoolRow[] | null>(null);
  const [instances, setInstances] = useState<CatalogInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // HI-05: activeTab from URL search params
  const activeTab = useMemo(() => {
    const param = searchParams.get("tab");
    return param === "finished" ? "finished" as const : "active" as const;
  }, [searchParams]);

  const setActiveTab = useCallback((tab: "active" | "finished") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "active") params.delete("tab"); else params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);
  const [leaveModal, setLeaveModal] = useState<MePoolRow | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const [panel, setPanel] = useState<"NONE" | "CREATE" | "JOIN">("NONE");
  const [showWizard, setShowWizard] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);

  // Create form
  const [instanceId, setInstanceId] = useState<string>("");
  const [poolName, setPoolName] = useState("");
  const [poolDesc, setPoolDesc] = useState("");
  const [deadline, setDeadline] = useState<number>(10);
  const [timeZone, setTimeZone] = useState<string>(detectTz());
  const [requireApproval, setRequireApproval] = useState<boolean>(false);
  const [maxParticipants, setMaxParticipants] = useState<number>(20);
  const [pickTypesConfig, setPickTypesConfig] = useState<PoolPickTypesConfig | string | null>(null);

  // Join form
  const [inviteCode, setInviteCode] = useState("");

  const [busy, setBusy] = useState(false);

  // Filter pools into active vs finished tabs
  const activePools = useMemo(() => {
    if (!rows) return [];
    return rows.filter(
      (r) =>
        (r.status === "ACTIVE" || r.status === "PENDING_APPROVAL") &&
        r.pool.status !== "COMPLETED" &&
        r.pool.status !== "ARCHIVED"
    );
  }, [rows]);

  const finishedPools = useMemo(() => {
    if (!rows) return [];
    return rows.filter(
      (r) =>
        r.status === "LEFT" ||
        r.pool.status === "COMPLETED" ||
        r.pool.status === "ARCHIVED"
    );
  }, [rows]);

  const displayedPools = activeTab === "active" ? activePools : finishedPools;

  async function onLeavePool(poolRow: MePoolRow) {
    if (!token) return;
    setLeaveBusy(true);
    try {
      await leavePool(token, poolRow.poolId);
      setLeaveModal(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLeaveBusy(false);
    }
  }

  async function loadAll() {
    if (!token) return;
    setError(null);
    try {
      const [pools, inst] = await Promise.all([getMePools(token), listCatalogInstances(token)]);
      setRows(pools);
      setInstances(inst);

      // default instance selection
      if (!instanceId && inst.length) setInstanceId(inst[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateCreate(): boolean {
    if (!instanceId) { setError(t("errors.selectInstance")); return false; }
    if (poolName.trim().length < 3) { setError(t("errors.poolNameMin")); return false; }
    if (!pickTypesConfig) { setError(t("errors.configRequired")); return false; }
    setError(null);
    return true;
  }

  function goToCapacityStep() {
    if (validateCreate()) setCreateStep(2);
  }

  async function onCreate() {
    if (!token) return;
    if (!validateCreate()) return;

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
        maxParticipants,
      });

      setPanel("NONE");
      setShowWizard(false);
      setCreateStep(1);
      setPickTypesConfig(null);
      await loadAll();
      router.push(`/pools/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  // Estilos responsivos
  const inputStyle = {
    padding: isMobile ? 14 : 10,
    fontSize: isMobile ? 16 : 14,
    minHeight: TOUCH_TARGET.minimum,
    borderRadius: radii.xl,
    border: `1px solid ${colors.border}`,
    width: "100%",
    boxSizing: "border-box" as const,
    ...mobileInteractiveStyles.tapHighlight,
  };

  const buttonStyle = {
    padding: isMobile ? "14px 16px" : "10px 12px",
    borderRadius: radii.xl,
    fontSize: isMobile ? fs.lg : fs.base,
    fontWeight: fw.medium,
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
          <div style={{ color: colors.textMuted, fontSize: isMobile ? fs.md : fs.sm }}>
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
                apiLogout().catch(() => {});
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
            borderRadius: radii["2xl"],
            background: "#fee",
            border: "1px solid #fbb",
            fontSize: isMobile ? fs.base : fs.md,
          }}
        >
          {error}
        </div>
      )}

      {!rows && !error && <p style={{ marginTop: 18 }}>{t("loading")}</p>}

      {rows && (
        <>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginTop: 16,
              borderBottom: `2px solid ${colors.borderLight}`,
            }}
          >
            {(["active", "finished"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: isMobile ? "12px 16px" : "10px 20px",
                  fontSize: isMobile ? fs.lg : fs.base,
                  fontWeight: activeTab === tab ? fw.bold : fw.medium,
                  color: activeTab === tab ? colors.text : "#888",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? `2px solid ${colors.text}` : "2px solid transparent",
                  marginBottom: -2,
                  cursor: "pointer",
                  ...mobileInteractiveStyles.tapHighlight,
                }}
              >
                {tab === "active" ? t("tabActive") : t("tabFinished")}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: fs.sm,
                    padding: "2px 6px",
                    borderRadius: radii.pill,
                    background: activeTab === tab ? colors.text : colors.borderLight,
                    color: activeTab === tab ? colors.white : colors.textMuted,
                  }}
                >
                  {tab === "active" ? activePools.length : finishedPools.length}
                </span>
              </button>
            ))}
          </div>

          {/* Pool cards */}
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {displayedPools.map((r) => (
              <PoolCard
                key={r.poolId}
                row={r}
                isMobile={isMobile}
                t={t}
                te={te}
                getPoolStatusBadge={getPoolStatusBadge}
                onLeave={(row) => setLeaveModal(row)}
              />
            ))}

            {displayedPools.length === 0 && (
              <div
                style={{
                  padding: isMobile ? 24 : 14,
                  border: `1px dashed ${colors.disabled}`,
                  borderRadius: radii["3xl"],
                  color: colors.textMuted,
                  textAlign: "center",
                  fontSize: isMobile ? fs.lg : fs.base,
                }}
              >
                {activeTab === "active" ? t("emptyState") : t("noFinishedPools")}
              </div>
            )}
          </div>
        </>
      )}

      {/* Leave Pool Confirmation Modal */}
      {leaveModal && (
        <LeavePoolModal
          pool={leaveModal}
          isMobile={isMobile}
          busy={leaveBusy}
          onConfirm={() => onLeavePool(leaveModal)}
          onCancel={() => setLeaveModal(null)}
          t={t}
        />
      )}

      {/* Panel Modal */}
      {panel !== "NONE" && (
        <CreateJoinPanel
          panel={panel as "CREATE" | "JOIN"}
          onClose={() => { setPanel("NONE"); setCreateStep(1); }}
          createStep={createStep}
          setCreateStep={setCreateStep}
          showWizard={showWizard}
          setShowWizard={setShowWizard}
          instanceId={instanceId}
          setInstanceId={setInstanceId}
          instances={instances}
          poolName={poolName}
          setPoolName={setPoolName}
          poolDesc={poolDesc}
          setPoolDesc={setPoolDesc}
          deadline={deadline}
          setDeadline={setDeadline}
          timeZone={timeZone}
          setTimeZone={setTimeZone}
          requireApproval={requireApproval}
          setRequireApproval={setRequireApproval}
          maxParticipants={maxParticipants}
          setMaxParticipants={setMaxParticipants}
          pickTypesConfig={pickTypesConfig}
          setPickTypesConfig={setPickTypesConfig}
          goToCapacityStep={goToCapacityStep}
          onCreate={onCreate}
          inviteCode={inviteCode}
          setInviteCode={setInviteCode}
          onJoin={onJoin}
          token={token}
          isMobile={isMobile}
          busy={busy}
          t={t}
          tc={tc}
          inputStyle={inputStyle}
        />
      )}
    </div>
  );
}
