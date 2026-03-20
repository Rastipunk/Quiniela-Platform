/**
 * Pool Creation Wizard — Types
 *
 * Defines the state shape, actions, and step types for the unified
 * pool creation wizard used by both standard and corporate flows.
 */

import type { PoolPickTypesConfig, PickConfigPresetKey } from "./pickConfig";

// ── Wizard mode ──────────────────────────────────────────────

export type WizardMode = "standard" | "corporate";

// ── Steps ────────────────────────────────────────────────────

export type WizardStep =
  | "COMPANY_INFO"       // Corporate only (step 0)
  | "TOURNAMENT"         // Select tournament
  | "NAME_DETAILS"       // Pool name, description, deadline, timezone
  | "SCORING"            // Preset selection + editable configuration
  | "ADVANCED_RULES"     // Extra time, phase multipliers
  | "CAPACITY"           // Max participants
  | "EMPLOYEE_INVITES"   // Corporate only
  | "SUMMARY";           // Review & create

export const STANDARD_STEPS: WizardStep[] = [
  "TOURNAMENT",
  "NAME_DETAILS",
  "SCORING",
  "ADVANCED_RULES",
  "CAPACITY",
  "SUMMARY",
];

export const CORPORATE_STEPS: WizardStep[] = [
  "COMPANY_INFO",
  "TOURNAMENT",
  "NAME_DETAILS",
  "SCORING",
  "ADVANCED_RULES",
  "CAPACITY",
  "EMPLOYEE_INVITES",
  "SUMMARY",
];

// ── Scoring style (user-facing names for presets) ────────────

export type ScoringStyle = PickConfigPresetKey; // "CUMULATIVE" | "BASIC" | "SIMPLE" | "CUSTOM"

// ── Instance phase (from API) ────────────────────────────────

export interface InstancePhase {
  id: string;
  name: string;
  type: string;
  twoLegged?: boolean;
  legNumber?: number;
}

// ── Wizard state ─────────────────────────────────────────────

export interface WizardState {
  mode: WizardMode;
  currentStep: WizardStep;

  // Step 0: Company info (corporate only)
  companyName: string;
  logoBase64: string;
  welcomeMessage: string;
  invitationMessage: string;

  // Step 1: Tournament
  instanceId: string;
  instanceName: string;
  instancePhases: InstancePhase[];
  phasesLoaded: boolean;

  // Step 2: Name & details
  poolName: string;
  poolDescription: string;
  deadlineMinutesBeforeKickoff: number;
  timeZone: string;
  requireApproval: boolean;

  // Step 3: Scoring
  scoringStyle: ScoringStyle | null;
  scoringConfig: PoolPickTypesConfig;

  // Step 4: Advanced rules
  // (stored within scoringConfig — includeExtraTime per phase, autoScaling)

  // Step 5: Capacity
  maxParticipants: number;

  // Step 6.5: Employee invites (corporate only)
  employeeEmails: string;

  // UI state
  error: string | null;
  busy: boolean;
}

// ── Wizard actions ───────────────────────────────────────────

export type WizardAction =
  | { type: "GO_TO_STEP"; step: WizardStep }
  | { type: "SET_FIELD"; field: keyof WizardState; value: unknown }
  | { type: "SET_TOURNAMENT"; instanceId: string; instanceName: string }
  | { type: "SET_PHASES"; phases: InstancePhase[] }
  | { type: "SET_SCORING"; style: ScoringStyle; config: PoolPickTypesConfig }
  | { type: "UPDATE_SCORING_CONFIG"; config: PoolPickTypesConfig }
  | { type: "RESTORE"; state: Partial<WizardState> }
  | { type: "RESET" };

// ── Recommended values ──────────────────────────────────────

export const RECOMMENDED_DEADLINE = 10;
export const RECOMMENDED_MAX_PARTICIPANTS_STANDARD = 20;
export const RECOMMENDED_MAX_PARTICIPANTS_CORPORATE = 100;

// ── Phase-to-display name (for preset labels) ────────────────

export const PHASE_DISPLAY_NAMES: Record<string, string> = {
  group_stage: "Fase de Grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos de Final",
  quarter_finals: "Cuartos de Final",
  semi_finals: "Semifinales",
  final: "Final",
  r32_leg1: "32avos (Ida)",
  r32_leg2: "32avos (Vuelta)",
  r16_leg1: "Octavos (Ida)",
  r16_leg2: "Octavos (Vuelta)",
  qf_leg1: "Cuartos (Ida)",
  qf_leg2: "Cuartos (Vuelta)",
  sf_leg1: "Semifinal (Ida)",
  sf_leg2: "Semifinal (Vuelta)",
};
