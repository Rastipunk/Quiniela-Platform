// Preset catalog used by the ScoringEditor preset picker.
// Lives in its own module so callers (like StepScoring's wizard
// wrapper) can grab the icon/colours for headers without pulling in
// the full editor component tree.
//
// User-facing text (name, tagline, description, example) is NOT
// stored here — it lives in messages/{es,en,pt}/poolWizard.json under
// `scoring.presets.{KEY}.*` and the consumer resolves it via the
// `useTranslations()` hook. Storing copy here was the source of the
// "Spanish strings leak into EN/PT" bug reported by wildesbunch.

import { colors } from "@/lib/theme";
import type { PickConfigPresetKey } from "@/types/pickConfig";

export type PresetInfo = {
  key: PickConfigPresetKey;
  icon: string;
  /** "RECOMENDADO" badge is rendered by the consumer when true. */
  recommended?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
};

export const PRESETS: PresetInfo[] = [
  {
    key: "CUMULATIVE",
    icon: "\u{1F3C6}",
    recommended: true,
    color: colors.brand,
    bgColor: "rgba(79,70,229,0.06)",
    borderColor: colors.brand,
  },
  {
    key: "BASIC",
    icon: "\u{1F3AF}",
    color: colors.successAlt,
    bgColor: "rgba(5,150,105,0.06)",
    borderColor: colors.successAlt,
  },
  {
    key: "SIMPLE",
    icon: "\u{1F9E0}",
    color: "#d97706",
    bgColor: "rgba(217,119,6,0.06)",
    borderColor: "#d97706",
  },
  {
    key: "CUSTOM",
    icon: "⚙️",
    color: colors.purple,
    bgColor: "rgba(124,58,237,0.06)",
    borderColor: colors.purple,
  },
];
