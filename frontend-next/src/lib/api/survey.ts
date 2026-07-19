// Post-World-Cup survey API (ADR-089)
import { requestJson } from "./client";

export type SurveyStatus = {
  open: boolean;
  opensAtUtc: string | null;
  closesAtUtc: string | null;
  alreadySubmitted: boolean;
  isHost: boolean;
};

export type SurveySubmitBody = {
  overallScore: number; // 1-10
  recommendScore: number; // 1-10
  otherTournamentsScore: number; // 1-10
  locale?: string;
};

export type SurveyDetailsBody = {
  comment?: string;
  shareConsent?: boolean;
  hostCreateScore?: number;
  hostInviteScore?: number;
  hostLiveResultsScore?: number;
  hostRulesScore?: number;
  hostSupportScore?: number;
};

export async function getSurveyStatus(): Promise<SurveyStatus> {
  return requestJson<SurveyStatus>("/survey/status", { method: "GET" });
}

export async function submitSurvey(
  body: SurveySubmitBody,
): Promise<{ ok: boolean; submitted?: boolean; alreadySubmitted?: boolean }> {
  return requestJson("/survey", { method: "POST", body: JSON.stringify(body) });
}

export async function submitSurveyDetails(
  body: SurveyDetailsBody,
): Promise<{ ok: boolean; updated?: boolean }> {
  return requestJson("/survey/details", { method: "POST", body: JSON.stringify(body) });
}
