import { describe, it, expect } from "vitest";
import {
  surveySubmitSchema,
  surveyDetailsSchema,
  recommendBuckets,
  HOST_SCORE_FIELDS,
} from "./surveyValidation";

describe("surveySubmitSchema (screen 1 — three mandatory 1-10 scales)", () => {
  const valid = { overallScore: 8, recommendScore: 10, otherTournamentsScore: 1 };

  it("accepts a valid payload (bounds 1 and 10 included)", () => {
    expect(surveySubmitSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects 0, 11, floats, and missing fields", () => {
    expect(surveySubmitSchema.safeParse({ ...valid, overallScore: 0 }).success).toBe(false);
    expect(surveySubmitSchema.safeParse({ ...valid, recommendScore: 11 }).success).toBe(false);
    expect(surveySubmitSchema.safeParse({ ...valid, otherTournamentsScore: 7.5 }).success).toBe(false);
    expect(surveySubmitSchema.safeParse({ overallScore: 5, recommendScore: 5 }).success).toBe(false);
  });

  it("accepts optional locale, rejects junk locale", () => {
    expect(surveySubmitSchema.safeParse({ ...valid, locale: "es" }).success).toBe(true);
    expect(surveySubmitSchema.safeParse({ ...valid, locale: "x" }).success).toBe(false);
  });
});

describe("surveyDetailsSchema (screen 2 — all optional)", () => {
  it("accepts an empty object (Omitir path safety)", () => {
    expect(surveyDetailsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts comment + consent + host scores in range", () => {
    const r = surveyDetailsSchema.safeParse({
      comment: "  gran plataforma  ",
      shareConsent: true,
      hostCreateScore: 9,
      hostSupportScore: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comment).toBe("gran plataforma"); // trimmed
  });

  it("rejects out-of-range host scores and oversized comments", () => {
    expect(surveyDetailsSchema.safeParse({ hostInviteScore: 0 }).success).toBe(false);
    expect(surveyDetailsSchema.safeParse({ hostRulesScore: 11 }).success).toBe(false);
    expect(surveyDetailsSchema.safeParse({ comment: "x".repeat(2001) }).success).toBe(false);
  });

  it("HOST_SCORE_FIELDS covers exactly the 5 owner-defined dimensions", () => {
    expect([...HOST_SCORE_FIELDS]).toEqual([
      "hostCreateScore",
      "hostInviteScore",
      "hostLiveResultsScore",
      "hostRulesScore",
      "hostSupportScore",
    ]);
  });
});

describe("recommendBuckets (1-10 scale)", () => {
  it("classifies promoters (9-10), passives (7-8), detractors (1-6)", () => {
    const r = recommendBuckets([10, 9, 8, 7, 6, 1]);
    expect(r).toMatchObject({ promoters: 2, passives: 2, detractors: 2 });
    expect(r.npsLike).toBe(0); // 2 promoters − 2 detractors over 6 → 0
  });

  it("computes npsLike with one-decimal rounding", () => {
    // 2 promoters, 1 detractor of 3 → (1/3)*100 = 33.3
    expect(recommendBuckets([9, 10, 3]).npsLike).toBe(33.3);
    expect(recommendBuckets([1, 2]).npsLike).toBe(-100);
  });

  it("returns zeros for empty input", () => {
    expect(recommendBuckets([])).toEqual({ promoters: 0, passives: 0, detractors: 0, npsLike: 0 });
  });
});
