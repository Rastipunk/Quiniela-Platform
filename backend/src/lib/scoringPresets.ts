export type ScoringPresetKey = "CLASSIC" | "OUTCOME_ONLY" | "EXACT_HEAVY";

export type ScoringPreset = {
  key: ScoringPresetKey;
  name: string;
  description: string;
  outcomePoints: number;
  exactScoreBonus: number;
  allowScorePick: boolean;
};

export const SCORING_PRESETS: Record<ScoringPresetKey, ScoringPreset> = {
  CLASSIC: {
    key: "CLASSIC",
    name: "Clásico",
    description: "3 pts por ganador/empate + 2 bonus por marcador exacto.",
    outcomePoints: 3,
    exactScoreBonus: 2,
    allowScorePick: true,
  },
  OUTCOME_ONLY: {
    key: "OUTCOME_ONLY",
    name: "Solo ganador/empate",
    description: "3 pts por ganador/empate (sin marcador exacto).",
    outcomePoints: 3,
    exactScoreBonus: 0,
    allowScorePick: false,
  },
  EXACT_HEAVY: {
    key: "EXACT_HEAVY",
    name: "Marcador pesado",
    description: "2 pts por ganador/empate + 3 bonus por exacto.",
    outcomePoints: 2,
    exactScoreBonus: 3,
    allowScorePick: true,
  },
};

export function getScoringPreset(key: string | null | undefined): ScoringPreset {
  const k = (key ?? "CLASSIC") as ScoringPresetKey;
  return SCORING_PRESETS[k] ?? SCORING_PRESETS.CLASSIC;
}
