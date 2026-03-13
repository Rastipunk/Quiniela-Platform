import { useTranslations } from "next-intl";
import { formatMatchDateTime } from "@/lib/timezone";

export function fmtUtc(iso: string, userTimezone: string | null = null) {
  return formatMatchDateTime(iso, userTimezone);
}

export function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export function formatPhaseName(phaseId: string, t: ReturnType<typeof useTranslations<"pool">>): string {
  const key = `phases.${phaseId}` as any;
  try { return t(key); } catch { return phaseId.replace(/_/g, " ").slice(0, 6); }
}

export function formatPhaseFullName(phaseId: string, t: ReturnType<typeof useTranslations<"pool">>): string {
  const key = `phasesLong.${phaseId}` as any;
  try { return t(key); } catch { return phaseId.replace(/_/g, " "); }
}

export function getPoolStatusBadge(status: string, t: ReturnType<typeof useTranslations<"pool">>): { label: string; color: string; emoji: string } {
  switch (status) {
    case "DRAFT":
      return { label: t("status.DRAFT"), color: "#f59e0b", emoji: "📝" };
    case "ACTIVE":
      return { label: t("status.ACTIVE"), color: "#10b981", emoji: "⚽" };
    case "COMPLETED":
      return { label: t("status.COMPLETED"), color: "#3b82f6", emoji: "🏆" };
    case "ARCHIVED":
      return { label: t("status.ARCHIVED"), color: "#6b7280", emoji: "📦" };
    default:
      return { label: t("status.UNKNOWN"), color: "#9ca3af", emoji: "❓" };
  }
}

export function isPlaceholder(teamId: string) {
  return teamId === "t_TBD" || teamId.startsWith("W_") || teamId.startsWith("RU_") || teamId.startsWith("L_") || teamId.startsWith("3rd_");
}

export function getPlaceholderName(teamId: string, t: ReturnType<typeof useTranslations<"pool">>): string {
  if (teamId.startsWith("W_")) {
    const ref = teamId.replace("W_", "");
    if (ref.startsWith("R") || ref.startsWith("Q") || ref.startsWith("S")) {
      return t("placeholders.winner", { ref });
    }
    return t("placeholders.winnerGroup", { group: ref });
  }
  if (teamId.startsWith("RU_")) {
    const group = teamId.replace("RU_", "");
    return t("placeholders.runnerUp", { group });
  }
  if (teamId.startsWith("L_")) {
    const ref = teamId.replace("L_", "");
    return t("placeholders.loser", { ref });
  }
  if (teamId.startsWith("3rd_POOL_")) {
    const rank = teamId.replace("3rd_POOL_", "");
    return t("placeholders.bestThird", { rank });
  }
  return teamId;
}
