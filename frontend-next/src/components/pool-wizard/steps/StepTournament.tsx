"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { colors, radii, spacing, fontSize, fontWeight, shadows } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/hooks/useAuth";
import { useWizard } from "../PoolWizardContext";
import { PoolWizardStepContainer } from "../PoolWizardStepContainer";
import { TOURNAMENT_CATALOG, type TournamentEntry } from "@/lib/tournamentCatalog";
import { listInstances, getInstancePhases, type CatalogInstance } from "@/lib/api/pools";

export function StepTournament() {
  const t = useTranslations("poolWizard");
  const isMobile = useIsMobile();
  const { token } = useAuth();
  const { state, dispatch } = useWizard();

  const [instances, setInstances] = useState<CatalogInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch catalog instances on mount
  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        setLoading(true);
        const data = await listInstances(token ?? "");
        if (!cancelled) setInstances(data);
      } catch {
        if (!cancelled) setError(t("tournamentLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [token, t]);

  // Match catalog entries with backend instances
  const getInstanceForEntry = useCallback(
    (entry: TournamentEntry): CatalogInstance | undefined => {
      if (!entry.active || !entry.templateKey) return undefined;
      return instances.find((inst) => inst.id === entry.templateKey || inst.name?.toLowerCase().includes(entry.templateKey!.replace(/_/g, " ")));
    },
    [instances],
  );

  // Resolve instance by matching template key more broadly
  const resolveInstance = useCallback(
    (entry: TournamentEntry): CatalogInstance | undefined => {
      if (!entry.active || !entry.templateKey) return undefined;
      // Try exact template key match first, then partial name match
      return (
        instances.find((inst) => (inst as any).template?.key === entry.templateKey) ??
        instances.find((inst) => (inst as any).templateKey === entry.templateKey) ??
        getInstanceForEntry(entry)
      );
    },
    [instances, getInstanceForEntry],
  );

  const handleSelect = useCallback(
    async (entry: TournamentEntry, instance: CatalogInstance) => {
      if (loadingPhases) return;

      dispatch({
        type: "SET_TOURNAMENT",
        instanceId: instance.id,
        instanceName: instance.name,
      });

      setLoadingPhases(true);
      try {
        const { phases } = await getInstancePhases(token ?? "", instance.id);
        dispatch({ type: "SET_PHASES", phases });
      } catch {
        setError(t("phasesLoadError"));
      } finally {
        setLoadingPhases(false);
      }
    },
    [dispatch, token, loadingPhases, t],
  );

  const isSelected = (instance?: CatalogInstance) =>
    instance && state.instanceId === instance.id;

  return (
    <PoolWizardStepContainer
      title={t("tournamentTitle")}
      subtitle={t("tournamentSubtitle")}
      icon="🏆"
    >
      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: spacing["4xl"] }}>
          <div style={spinnerStyle} />
          <p style={{ color: colors.textMuted, marginTop: spacing.md, fontSize: fontSize.base }}>
            {t("loadingTournaments")}
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div style={{
          padding: spacing.lg,
          background: colors.errorBg,
          border: `1px solid ${colors.errorBorder}`,
          borderRadius: radii.lg,
          color: colors.error,
          fontSize: fontSize.base,
          textAlign: "center",
        }}>
          {error}
        </div>
      )}

      {/* Tournament grid */}
      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: spacing.lg,
          }}
        >
          {TOURNAMENT_CATALOG.map((entry) => {
            const instance = resolveInstance(entry);
            const selected = isSelected(instance);
            const disabled = !entry.active || !instance;
            const isLoadingThis = loadingPhases && selected;

            return (
              <button
                key={entry.key}
                type="button"
                disabled={disabled || loadingPhases}
                onClick={() => {
                  if (instance && !disabled) handleSelect(entry, instance);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: isMobile ? spacing.lg : spacing.xl,
                  border: selected
                    ? `2px solid ${colors.brand}`
                    : `1px solid ${colors.borderLight}`,
                  borderRadius: radii["2xl"],
                  background: selected
                    ? `linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(124,58,237,0.04) 100%)`
                    : disabled
                      ? colors.bgLight
                      : colors.white,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  width: "100%",
                  position: "relative",
                  boxShadow: selected ? `0 0 0 1px ${colors.brand}` : "none",
                }}
                onMouseEnter={(e) => {
                  if (!disabled && !selected) {
                    e.currentTarget.style.borderColor = colors.brandLight;
                    e.currentTarget.style.boxShadow = shadows.sm;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled && !selected) {
                    e.currentTarget.style.borderColor = colors.borderLight;
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {/* Emoji */}
                <span style={{
                  fontSize: isMobile ? 28 : 32,
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
                  {entry.emoji}
                </span>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isMobile ? fontSize.base : fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: disabled ? colors.textMuted : colors.text,
                    lineHeight: 1.3,
                  }}>
                    {t(`tournaments.${entry.i18nKey}`)}
                  </div>

                  {/* Coming Soon badge */}
                  {!entry.active && (
                    <span style={{
                      display: "inline-block",
                      marginTop: spacing.xs,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: colors.warningDarker,
                      background: colors.warningBgAmber,
                      border: `1px solid ${colors.warningBorderLight}`,
                      borderRadius: radii.pill,
                      padding: "2px 10px",
                    }}>
                      {t("comingSoon")}
                    </span>
                  )}
                </div>

                {/* Loading spinner for selected */}
                {isLoadingThis && (
                  <div style={spinnerSmallStyle} />
                )}

                {/* Checkmark for selected */}
                {selected && !isLoadingThis && (
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: radii.circle as string,
                    background: colors.brand,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7L6 10L11 4"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </PoolWizardStepContainer>
  );
}

// ── Spinner styles ────────────────────────────────────────────

const spinnerKeyframes = `
@keyframes p4a-spin {
  to { transform: rotate(360deg); }
}
`;

// Inject keyframes once
if (typeof document !== "undefined") {
  const id = "p4a-spin-keyframes";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = spinnerKeyframes;
    document.head.appendChild(style);
  }
}

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: `3px solid ${colors.borderLight}`,
  borderTopColor: colors.brand,
  borderRadius: "50%",
  animation: "p4a-spin 0.8s linear infinite",
  margin: "0 auto",
};

const spinnerSmallStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  border: `2px solid ${colors.borderLight}`,
  borderTopColor: colors.brand,
  borderRadius: "50%",
  animation: "p4a-spin 0.8s linear infinite",
  flexShrink: 0,
};
