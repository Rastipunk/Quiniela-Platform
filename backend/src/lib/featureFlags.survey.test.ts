import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSurveyAllowlisted, isSurveyOpenFor, getSurveyWindow } from "./featureFlags";

const KEYS = ["SURVEY_ALLOWLIST", "SURVEY_OPENS_AT", "SURVEY_CLOSES_AT"] as const;
const saved: Record<string, string | undefined> = {};

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("survey feature flags (ADR-089)", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is fully closed by default (no envs)", () => {
    expect(isSurveyAllowlisted("a@x.com")).toBe(false);
    expect(isSurveyOpenFor("a@x.com")).toBe(false);
  });

  it("allowlist: '*' admits everyone, csv admits case-insensitively", () => {
    process.env.SURVEY_ALLOWLIST = "*";
    expect(isSurveyAllowlisted("any@x.com")).toBe(true);
    process.env.SURVEY_ALLOWLIST = "A@x.com, b@y.com";
    expect(isSurveyAllowlisted("a@X.COM")).toBe(true);
    expect(isSurveyAllowlisted("c@z.com")).toBe(false);
  });

  it("open only inside the window", () => {
    process.env.SURVEY_ALLOWLIST = "*";
    process.env.SURVEY_OPENS_AT = iso(-60_000);
    process.env.SURVEY_CLOSES_AT = iso(60_000);
    expect(isSurveyOpenFor("a@x.com")).toBe(true);
  });

  it("closed before opensAt and after closesAt", () => {
    process.env.SURVEY_ALLOWLIST = "*";
    process.env.SURVEY_OPENS_AT = iso(60_000); // opens in the future
    process.env.SURVEY_CLOSES_AT = iso(120_000);
    expect(isSurveyOpenFor("a@x.com")).toBe(false);

    process.env.SURVEY_OPENS_AT = iso(-120_000);
    process.env.SURVEY_CLOSES_AT = iso(-60_000); // already closed
    expect(isSurveyOpenFor("a@x.com")).toBe(false);
  });

  it("fail-closed: missing or unparseable dates keep it closed even with '*'", () => {
    process.env.SURVEY_ALLOWLIST = "*";
    expect(isSurveyOpenFor("a@x.com")).toBe(false); // no dates

    process.env.SURVEY_OPENS_AT = "not-a-date";
    process.env.SURVEY_CLOSES_AT = iso(60_000);
    expect(isSurveyOpenFor("a@x.com")).toBe(false);
    expect(getSurveyWindow().opensAt).toBeNull();
  });

  it("allowlist gates the window: open window but not allowlisted → closed", () => {
    process.env.SURVEY_ALLOWLIST = "only@me.com";
    process.env.SURVEY_OPENS_AT = iso(-60_000);
    process.env.SURVEY_CLOSES_AT = iso(60_000);
    expect(isSurveyOpenFor("other@x.com")).toBe(false);
    expect(isSurveyOpenFor("only@me.com")).toBe(true);
  });
});
