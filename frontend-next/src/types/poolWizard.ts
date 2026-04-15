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
  "SUMMARY",
  "CAPACITY",
];

export const CORPORATE_STEPS: WizardStep[] = [
  "COMPANY_INFO",
  "TOURNAMENT",
  "NAME_DETAILS",
  "SCORING",
  "ADVANCED_RULES",
  "EMPLOYEE_INVITES",
  "SUMMARY",
  "CAPACITY",
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

export const RECOMMENDED_DEADLINE = parseInt(process.env.NEXT_PUBLIC_DEFAULT_DEADLINE || "10", 10);
export const RECOMMENDED_MAX_PARTICIPANTS_STANDARD = parseInt(process.env.NEXT_PUBLIC_PERSONAL_FREE_LIMIT || "20", 10);
export const RECOMMENDED_MAX_PARTICIPANTS_CORPORATE = parseInt(process.env.NEXT_PUBLIC_CORPORATE_FREE_LIMIT || "100", 10);

// Phase display names are in i18n: messages/{locale}/poolWizard.json → "phases"
