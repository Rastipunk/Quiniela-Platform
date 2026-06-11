import { describe, it, expect } from "vitest";
import { decideMasterOverrideAction } from "./matchMonitorService";

// Pure per-pool decision of the master override (Etapa 3B, audit §6).
// The orchestration around it (tx, fan-out, hooks) is exercised in
// production verification; the DECISION is what must never be wrong.
describe("decideMasterOverrideAction", () => {
  const base = {
    homeGoals: 2,
    awayGoals: 1,
    homeGoals90: null,
    awayGoals90: null,
    homePenalties: null,
    awayPenalties: null,
    overwriteHostOverrides: false,
  };

  const cv = (over: Partial<NonNullable<Parameters<typeof decideMasterOverrideAction>[0]>>) => ({
    source: "API_CONFIRMED",
    homeGoals: 2,
    awayGoals: 1,
    homeGoals90: null,
    awayGoals90: null,
    homePenalties: null,
    awayPenalties: null,
    ...over,
  });

  it("writes when the pool has no result at all (emergency path)", () => {
    expect(decideMasterOverrideAction(null, base)).toBe("write");
  });

  it("writes over API_CONFIRMED even with identical values (freezes the result against the scraper)", () => {
    expect(decideMasterOverrideAction(cv({}), base)).toBe("write");
  });

  it("writes over SCRAPER_PROVISIONAL", () => {
    expect(decideMasterOverrideAction(cv({ source: "SCRAPER_PROVISIONAL", homeGoals: 0, awayGoals: 0 }), base)).toBe("write");
  });

  it("SKIPS a host override by default — the host's judgment wins", () => {
    expect(
      decideMasterOverrideAction(cv({ source: "HOST_OVERRIDE", homeGoals: 3 }), base),
    ).toBe("skip_host");
  });

  it("overwrites a host override only when explicitly requested", () => {
    expect(
      decideMasterOverrideAction(cv({ source: "HOST_OVERRIDE", homeGoals: 3 }), {
        ...base,
        overwriteHostOverrides: true,
      }),
    ).toBe("write");
  });

  it("reports unchanged when an identical HOST_OVERRIDE already exists (no version churn)", () => {
    expect(
      decideMasterOverrideAction(cv({ source: "HOST_OVERRIDE" }), base),
    ).toBe("unchanged");
  });

  it("treats goals90 / penalties as part of the identity comparison", () => {
    // Same final score but the admin is adding the missing 90' data —
    // that's a real change, must write (with the flag, since host row).
    expect(
      decideMasterOverrideAction(cv({ source: "HOST_OVERRIDE" }), {
        ...base,
        homeGoals90: 1,
        awayGoals90: 1,
        overwriteHostOverrides: true,
      }),
    ).toBe("write");
    expect(
      decideMasterOverrideAction(
        cv({ source: "HOST_OVERRIDE", homeGoals90: 1, awayGoals90: 1 }),
        { ...base, homeGoals90: 1, awayGoals90: 1 },
      ),
    ).toBe("unchanged");
  });
});
