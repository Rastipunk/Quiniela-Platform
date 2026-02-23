/**
 * Tournament catalog — maps template keys to display metadata.
 * Used on the landing page and pool creation flow.
 *
 * Active tournaments link to real TournamentInstances in the DB.
 * "Coming soon" entries are display-only (no backend instance).
 */

export type TournamentEntry = {
  key: string;
  /** i18n key inside "tournaments.items.<key>" */
  i18nKey: string;
  /** Emoji used as visual icon (lightweight, no external images needed) */
  emoji: string;
  /** Whether there's a playable instance in the backend */
  active: boolean;
  /** Template key to match against catalog instances (only for active) */
  templateKey?: string;
};

export const TOURNAMENT_CATALOG: TournamentEntry[] = [
  {
    key: "wc2026",
    i18nKey: "wc2026",
    emoji: "🏆",
    active: true,
    templateKey: "wc_2026_sandbox",
  },
  {
    key: "ucl2025",
    i18nKey: "ucl2025",
    emoji: "⭐",
    active: true,
    templateKey: "ucl-2025",
  },
  {
    key: "copaAmerica2028",
    i18nKey: "copaAmerica2028",
    emoji: "🌎",
    active: false,
  },
  {
    key: "euro2028",
    i18nKey: "euro2028",
    emoji: "🇪🇺",
    active: false,
  },
  {
    key: "nationsLeague",
    i18nKey: "nationsLeague",
    emoji: "🏅",
    active: false,
  },
  {
    key: "libertadores",
    i18nKey: "libertadores",
    emoji: "🔥",
    active: false,
  },
  {
    key: "sudamericana",
    i18nKey: "sudamericana",
    emoji: "⚡",
    active: false,
  },
  {
    key: "premierLeague",
    i18nKey: "premierLeague",
    emoji: "🦁",
    active: false,
  },
];
