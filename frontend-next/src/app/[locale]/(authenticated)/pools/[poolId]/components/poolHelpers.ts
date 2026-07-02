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

/**
 * Resolve a real team's display name from the trilingual `teams.{code}`
 * catalog (FIFA 3-letter codes — MEX, BRA, KOR, ...). Pre-fix the UI
 * rendered `team.name` from dataJson which is Spanish-only ("México",
 * "Sudáfrica", "Corea del Sur") so EN/PT users saw Spanish — see
 * I18N_AUDIT F-5.
 *
 * Use this for REAL teams. Placeholders ("W_A", "RU_B", "3rd_POOL_*",
 * "t_TBD") go through `getPlaceholderName` instead — call sites
 * typically branch on `isPlaceholder(team.id)` first.
 *
 * Fallback chain:
 *   1. `teams.{code}` from the i18n catalog (covers all WC2026 nations)
 *   2. `team.name` from dataJson (Spanish fallback — better than empty)
 *   3. `team.id` (last resort)
 */
export function getTeamName(
  team: { id: string; name?: string | null; code?: string | null } | null | undefined,
  t: ReturnType<typeof useTranslations<"teams">>,
): string {
  if (!team) return "";
  const tDynamic = t as (key: string) => string;
  if (team.code) {
    try {
      const translated = tDynamic(team.code);
      // next-intl returns the key itself when not found (no throw); guard
      // against that so we fall through to `team.name`.
      if (translated && translated !== team.code) return translated;
    } catch {
      // ignore — fall through
    }
  }
  return team.name ?? team.id;
}

/**
 * Resolve a tournament's display name from the trilingual `tournaments`
 * catalog keyed by `TournamentTemplate.key` (e.g. `wc_2026_sandbox` →
 * "World Cup 2026"/"Copa Mundial 2026"/"Copa do Mundo 2026"). See
 * I18N_AUDIT F-7.
 *
 * Fallback chain:
 *   1. `tournaments.{templateKey}` from the i18n catalog
 *   2. The stored `TournamentInstance.name` (single-locale, e.g.
 *      "World Cup 2026") — used for instances whose template key is
 *      not yet in the catalog
 *   3. An empty string (caller decides whether to render a placeholder)
 */
export function getTournamentName(
  templateKey: string | null | undefined,
  fallbackName: string | null | undefined,
  t: ReturnType<typeof useTranslations<"tournaments">>,
): string {
  if (templateKey) {
    const tDynamic = t as (key: string) => string;
    try {
      const translated = tDynamic(templateKey);
      if (translated && translated !== templateKey) return translated;
    } catch {
      // ignore — fall through
    }
  }
  return fallbackName ?? "";
}

export function isPlaceholder(teamId: string) {
  return teamId === "t_TBD" || teamId.startsWith("W_") || teamId.startsWith("RU_") || teamId.startsWith("L_") || teamId.startsWith("3rd_");
}

/**
 * Player-facing phase state (ADR-084 knockout-release gate):
 *  - GROUP_ACTIVE: group stage in progress
 *  - PENDING:   knockout phase whose teams aren't determined yet (placeholders)
 *  - CONFIRMING: teams known, admin gate ON but not released yet ("en unos minutos")
 *  - OPEN:      released (or gate OFF) → predictions open
 *  - FINALIZED: every match of the phase finished
 */
export type PhaseUiState = "GROUP_ACTIVE" | "PENDING" | "CONFIRMING" | "OPEN" | "FINALIZED";

interface PhaseStateMatch {
  phaseId?: string;
  homeTeam?: { id?: string } | null;
  awayTeam?: { id?: string } | null;
  result?: unknown;
  isLive?: boolean;
}

export function derivePhaseState(
  phaseId: string,
  matches: PhaseStateMatch[],
  knockoutRelease?: { gateEnabled: boolean; releasedPhases: string[] },
): PhaseUiState {
  const isKnockout = phaseId !== "group_stage";
  const phaseMatches = matches.filter((m) => m.phaseId === phaseId);
  if (phaseMatches.length === 0) return isKnockout ? "PENDING" : "GROUP_ACTIVE";

  const allFinalized = phaseMatches.every((m) => !!m.result && !m.isLive);
  if (allFinalized) return "FINALIZED";
  if (!isKnockout) return "GROUP_ACTIVE";

  const hasPlaceholder = phaseMatches.some(
    (m) => isPlaceholder(m.homeTeam?.id ?? "") || isPlaceholder(m.awayTeam?.id ?? ""),
  );

  const gateEnabled = !!knockoutRelease?.gateEnabled;
  const released = knockoutRelease?.releasedPhases?.includes(phaseId) ?? false;
  // Progressive opening (ADR-087): a RELEASED phase is OPEN even while some
  // slots are still placeholders — each match card gates itself (pending
  // banner / disabled pick) and new matchups light up as feeders finish.
  if (gateEnabled && released) return "OPEN";
  if (hasPlaceholder) return "PENDING";
  if (gateEnabled) return "CONFIRMING";
  return "OPEN";
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

/**
 * Rich placeholder label (ADR-087): "Ganador de Espana vs Austria" instead of
 * "Ganador R32_11". W_/L_ placeholders reference a feeder match (m_<ref>);
 * when that feeder's teams are already real we name them. Falls back to
 * getPlaceholderName (short ref / group form) while the feeder itself is
 * still undecided.
 */
export function getPlaceholderDisplay(
  teamId: string,
  t: ReturnType<typeof useTranslations<"pool">>,
  tTeams: ReturnType<typeof useTranslations<"teams">>,
  allMatches:
    | Array<{
        id: string;
        homeTeam?: { id?: string; name?: string | null } | null;
        awayTeam?: { id?: string; name?: string | null } | null;
      }>
    | undefined,
): string {
  const prefix = teamId.startsWith("W_") ? "W_" : teamId.startsWith("L_") ? "L_" : null;
  if (prefix && allMatches) {
    const ref = teamId.slice(prefix.length);
    const feeder = allMatches.find((m) => m.id === `m_${ref}`);
    const home = feeder?.homeTeam;
    const away = feeder?.awayTeam;
    if (home?.id && away?.id && !isPlaceholder(home.id) && !isPlaceholder(away.id)) {
      return t(prefix === "W_" ? "placeholders.winnerOfMatch" : "placeholders.loserOfMatch", {
        home: getTeamName({ id: home.id, name: home.name, code: (home as { code?: string | null }).code }, tTeams),
        away: getTeamName({ id: away.id, name: away.name, code: (away as { code?: string | null }).code }, tTeams),
      });
    }
  }
  return getPlaceholderName(teamId, t);
}
