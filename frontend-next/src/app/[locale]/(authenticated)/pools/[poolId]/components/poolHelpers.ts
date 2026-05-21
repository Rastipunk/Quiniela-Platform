import { useTranslations } from "next-intl";
import { formatMatchDateTime } from "@/lib/timezone";

/**
 * Format a UTC ISO timestamp into the user's locale + timezone. The
 * locale argument is required for non-Spanish UI; without it the
 * underlying `formatMatchDateTime` falls back to `"es"` and EN/PT
 * users see Spanish month abbreviations like "11 jun 2026" — see
 * I18N_AUDIT.md F-2.
 *
 * Call sites are expected to read locale from next-intl's
 * `useLocale()` (already a Client Component since the pool zone is
 * client-rendered) and pass it through.
 */
export function fmtUtc(iso: string, userTimezone: string | null = null, locale: string = "es") {
  return formatMatchDateTime(iso, userTimezone, locale);
}

export function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export function formatPhaseName(phaseId: string, t: ReturnType<typeof useTranslations<"pool">>): string {
  // next-intl doesn't support computed keys at type level
  const tDynamic = t as (key: string) => string;
  const key = `phases.${phaseId}`;
  try { return tDynamic(key); } catch { return phaseId.replace(/_/g, " ").slice(0, 6); }
}

export function formatPhaseFullName(phaseId: string, t: ReturnType<typeof useTranslations<"pool">>): string {
  // next-intl doesn't support computed keys at type level
  const tDynamic = t as (key: string) => string;
  const key = `phasesLong.${phaseId}`;
  try { return tDynamic(key); } catch { return phaseId.replace(/_/g, " "); }
}

/**
 * Build a locale-aware label for a match, e.g. "Group A - Matchday 1" or
 * "Round of 32". Pre-fix the UI rendered `match.roundLabel` from the
 * dataJson, which is Spanish-only ("Grupo A - Jornada 1") so EN/PT
 * users saw Spanish — see I18N_AUDIT F-1.
 *
 * Strategy:
 *   - Group stage: parse the matchday number out of the matchId
 *     (pattern `m_{group}_MD{matchday}_{N}`) and combine with `groupId`
 *     via `t("matchCard.groupMatchLabel", { group, matchday })`.
 *   - Knockout phases: defer to `t("phasesLong.{phaseId}")` which has
 *     "Round of 32" / "Dieciseisavos de Final" / "32 avos de Final"
 *     already populated for the 3 locales.
 *   - Fallback chain: dataJson `roundLabel` → `matchCard.matchLabel`.
 *     Spanish leakage only happens if both the parse and the i18n
 *     lookup miss (should not occur for current WC2026 / UCL data).
 */
export function getMatchLabel(
  match: {
    id: string;
    phaseId: string;
    groupId: string | null;
    roundLabel: string | null;
    matchNumber: number | null;
  },
  t: ReturnType<typeof useTranslations<"pool">>,
): string {
  const tDynamic = t as (key: string, values?: Record<string, unknown>) => string;

  // Group-stage matches: extract the matchday number from the matchId.
  if (match.phaseId === "group_stage" && match.groupId) {
    const mdMatch = match.id.match(/_MD(\d+)_/);
    if (mdMatch) {
      return tDynamic("matchCard.groupMatchLabel", {
        group: match.groupId,
        matchday: Number(mdMatch[1]),
      });
    }
  }

  // Knockout phases: phasesLong.{phaseId} is already translated.
  try {
    return tDynamic(`phasesLong.${match.phaseId}`);
  } catch {
    // Last-resort fallback. roundLabel may be Spanish; better than
    // showing nothing.
    return match.roundLabel || tDynamic("matchCard.matchLabel", {
      id: match.matchNumber ?? match.id,
    });
  }
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
