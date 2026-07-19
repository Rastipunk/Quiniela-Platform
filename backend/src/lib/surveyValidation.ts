/**
 * Survey validation + pure summary math (ADR-089).
 *
 * Kept prisma-free so unit tests can import it without touching the DB layer.
 * All scales are 1-10 (owner decision — including the recommend question,
 * which therefore is NOT canonical 0-10 NPS; the bucket math below adapts
 * the promoter/passive/detractor cutoffs to the 1-10 scale).
 */

import { z } from "zod";

const score10 = z.number().int().min(1).max(10);

/** Screen 1 — the three mandatory scales. */
export const surveySubmitSchema = z.object({
  overallScore: score10,
  recommendScore: score10,
  otherTournamentsScore: score10,
  locale: z.string().min(2).max(5).optional(),
});

/** Host-only dimension fields, shared by schema and route filtering. */
export const HOST_SCORE_FIELDS = [
  "hostCreateScore",
  "hostInviteScore",
  "hostLiveResultsScore",
  "hostRulesScore",
  "hostSupportScore",
] as const;

/** Screen 2 — everything optional (comment, consent, host dimensions). */
export const surveyDetailsSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
  shareConsent: z.boolean().optional(),
  hostCreateScore: score10.optional(),
  hostInviteScore: score10.optional(),
  hostLiveResultsScore: score10.optional(),
  hostRulesScore: score10.optional(),
  hostSupportScore: score10.optional(),
});

export type SurveySubmitInput = z.infer<typeof surveySubmitSchema>;
export type SurveyDetailsInput = z.infer<typeof surveyDetailsSchema>;

/**
 * Recommend-score buckets on the 1-10 scale: promoters 9-10, passives 7-8,
 * detractors 1-6. `npsLike` = %promoters − %detractors (−100..100), rounded
 * to one decimal. Returns zeros for an empty input.
 */
export function recommendBuckets(scores: readonly number[]): {
  promoters: number;
  passives: number;
  detractors: number;
  npsLike: number;
} {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    if (s >= 9) promoters++;
    else if (s >= 7) passives++;
    else detractors++;
  }
  const n = scores.length;
  const npsLike = n === 0 ? 0 : Math.round(((promoters - detractors) / n) * 1000) / 10;
  return { promoters, passives, detractors, npsLike };
}
