"use client";

import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from "react";
import type {
  WizardState,
  WizardAction,
  WizardStep,
  WizardMode,
} from "../../types/poolWizard";
import {
  STANDARD_STEPS,
  CORPORATE_STEPS,
  RECOMMENDED_DEADLINE,
  RECOMMENDED_MAX_PARTICIPANTS_STANDARD,
  RECOMMENDED_MAX_PARTICIPANTS_CORPORATE,
} from "../../types/poolWizard";

// ── Initial state ───────────────────────────────────────────

function getInitialState(mode: WizardMode): WizardState {
  const isStandard = mode === "standard";
  return {
    mode,
    currentStep: isStandard ? "TOURNAMENT" : "COMPANY_INFO",
    companyName: "",
    logoBase64: "",
    welcomeMessage: "",
    invitationMessage: "",
    instanceId: "",
    instanceName: "",
    instancePhases: [],
    phasesLoaded: false,
    poolName: "",
    poolDescription: "",
    deadlineMinutesBeforeKickoff: RECOMMENDED_DEADLINE,
    timeZone: typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "America/Bogota",
    requireApproval: false,
    scoringStyle: null,
    scoringConfig: [],
    maxParticipants: isStandard
      ? RECOMMENDED_MAX_PARTICIPANTS_STANDARD
      : RECOMMENDED_MAX_PARTICIPANTS_CORPORATE,
    employeeEmails: "",
    error: null,
    busy: false,
  };
}

// ── Reducer ─────────────────────────────────────────────────

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "GO_TO_STEP":
      return { ...state, currentStep: action.step, error: null };

    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "SET_TOURNAMENT":
      return {
        ...state,
        instanceId: action.instanceId,
        instanceName: action.instanceName,
        phasesLoaded: false,
        instancePhases: [],
        // Reset scoring when tournament changes
        scoringStyle: null,
        scoringConfig: [],
      };

    case "SET_PHASES":
      return { ...state, instancePhases: action.phases, phasesLoaded: true };

    case "SET_SCORING":
      return {
        ...state,
        scoringStyle: action.style,
        scoringConfig: action.config,
      };

    case "UPDATE_SCORING_CONFIG":
      return { ...state, scoringConfig: action.config };

    case "RESTORE":
      return { ...state, ...action.state };

    case "RESET":
      return getInitialState(state.mode);

    default:
      return state;
  }
}

// ── Context shape ───────────────────────────────────────────

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  steps: WizardStep[];
  currentStepIndex: number;
  totalSteps: number;
  canGoNext: boolean;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

// ── Validation ──────────────────────────────────────────────

function validateStep(state: WizardState): boolean {
  switch (state.currentStep) {
    case "COMPANY_INFO":
      return state.companyName.trim().length >= 2;

    case "TOURNAMENT":
      return state.instanceId !== "" && state.phasesLoaded;

    case "NAME_DETAILS":
      return state.poolName.trim().length >= 3;

    case "SCORING":
      return state.scoringStyle !== null && state.scoringConfig.length > 0;

    case "ADVANCED_RULES":
      return true; // Optional step

    case "CAPACITY":
      return state.maxParticipants >= 2;

    case "EMPLOYEE_INVITES":
      return true; // Optional step

    case "SUMMARY":
      return true;

    default:
      return false;
  }
}

// ── localStorage persistence ────────────────────────────────

const STORAGE_KEY = "p4a_pool_wizard_draft";

function saveDraft(state: WizardState) {
  try {
    const toSave = { ...state, error: null, busy: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded or private browsing */ }
}

function loadDraft(): Partial<WizardState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let _draftCleared = false;

export function clearWizardDraft() {
  _draftCleared = true;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Provider ────────────────────────────────────────────────

export function PoolWizardProvider({
  mode,
  children,
}: {
  mode: WizardMode;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(wizardReducer, mode, getInitialState);

  const steps = mode === "corporate" ? CORPORATE_STEPS : STANDARD_STEPS;
  const currentStepIndex = steps.indexOf(state.currentStep);
  const canGoNext = validateStep(state);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Auto-save draft on state changes (skip if draft was just cleared after pool creation)
  useEffect(() => {
    if (_draftCleared) return;
    if (state.instanceId || state.poolName || state.companyName) {
      saveDraft(state);
    }
  }, [state]);

  // Restore draft on mount (skip if pool was just created)
  useEffect(() => {
    if (_draftCleared) {
      _draftCleared = false; // Reset for next mount
      return;
    }
    const draft = loadDraft();
    if (draft && draft.mode === mode && (draft.instanceId || draft.poolName)) {
      dispatch({ type: "RESTORE", state: draft });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      dispatch({ type: "GO_TO_STEP", step: steps[nextIndex]! });
    }
  }, [canGoNext, currentStepIndex, steps]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      dispatch({ type: "GO_TO_STEP", step: steps[prevIndex]! });
    }
  }, [currentStepIndex, steps]);

  const goToStep = useCallback((step: WizardStep) => {
    const targetIndex = steps.indexOf(step);
    // Only allow jumping to steps before or at current
    if (targetIndex >= 0 && targetIndex <= currentStepIndex) {
      dispatch({ type: "GO_TO_STEP", step });
    }
  }, [steps, currentStepIndex]);

  const value: WizardContextValue = {
    state,
    dispatch,
    steps,
    currentStepIndex,
    totalSteps: steps.length,
    canGoNext,
    goNext,
    goBack,
    goToStep,
    isFirstStep,
    isLastStep,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside PoolWizardProvider");
  return ctx;
}
