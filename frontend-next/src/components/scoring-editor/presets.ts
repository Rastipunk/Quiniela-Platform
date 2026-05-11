// Preset catalog used by the ScoringEditor preset picker.
// Lives in its own module so callers (like StepScoring's wizard
// wrapper) can grab just the icon/name for headers without
// pulling in the full editor component tree.

import { colors } from "@/lib/theme";
import type { PickConfigPresetKey } from "@/types/pickConfig";

export type PresetInfo = {
  key: PickConfigPresetKey;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  example: string;
  recommended?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
};

export const PRESETS: PresetInfo[] = [
  {
    key: "CUMULATIVE",
    icon: "\u{1F3C6}",
    name: "Predictor",
    tagline: "RECOMENDADO",
    description: "Puntos acumulables por cada criterio que aciertes",
    example: "Si dices 3-1 y sale 2-1 → Resultado ✓ (10pts) + Visitante ✓ (4pts) = 14pts",
    recommended: true,
    color: colors.brand,
    bgColor: "rgba(79,70,229,0.06)",
    borderColor: colors.brand,
  },
  {
    key: "BASIC",
    icon: "\u{1F3AF}",
    name: "Todo o Nada",
    tagline: "CLASICO",
    description: "Solo ganas puntos si aciertas el marcador exacto",
    example: "2-1 → 2-1 = 20pts  |  2-1 → 3-1 = 0pts",
    color: colors.successAlt,
    bgColor: "rgba(5,150,105,0.06)",
    borderColor: colors.successAlt,
  },
  {
    key: "SIMPLE",
    icon: "\u{1F9E0}",
    name: "Estratega",
    tagline: "SIN MARCADORES",
    description: "No predices marcadores. Predices posiciones y quien avanza",
    example: "1° Argentina, 2° Francia → 10pts por cada posicion!",
    color: "#d97706",
    bgColor: "rgba(217,119,6,0.06)",
    borderColor: "#d97706",
  },
  {
    key: "CUSTOM",
    icon: "⚙️",
    name: "Personalizado",
    tagline: "AVANZADO",
    description: "Disena tu propio sistema de puntos fase por fase",
    example: "Control total: elige criterios, puntos y reglas por fase",
    color: colors.purple,
    bgColor: "rgba(124,58,237,0.06)",
    borderColor: colors.purple,
  },
];
