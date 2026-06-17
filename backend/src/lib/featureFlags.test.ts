import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPredictionStatusEnabled } from "./featureFlags";

const ENV_KEY = "PREDICTION_STATUS_HOST_ALLOWLIST";

describe("isPredictionStatusEnabled", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("is OFF by default (env unset)", () => {
    expect(isPredictionStatusEnabled("juan@x.com")).toBe(false);
  });

  it("is OFF for an empty / whitespace env value", () => {
    process.env[ENV_KEY] = "   ";
    expect(isPredictionStatusEnabled("juan@x.com")).toBe(false);
  });

  it("is ON for everyone when set to '*'", () => {
    process.env[ENV_KEY] = "*";
    expect(isPredictionStatusEnabled("anyone@y.com")).toBe(true);
    // even when the creator email is unknown
    expect(isPredictionStatusEnabled(null)).toBe(true);
  });

  it("is ON only for a creator whose email is in the allowlist", () => {
    process.env[ENV_KEY] = "juan.k.chacon9729@gmail.com";
    expect(isPredictionStatusEnabled("juan.k.chacon9729@gmail.com")).toBe(true);
    expect(isPredictionStatusEnabled("someone.else@gmail.com")).toBe(false);
  });

  it("matches email case-insensitively and trims whitespace", () => {
    process.env[ENV_KEY] = "  Juan.K.Chacon9729@Gmail.com , beta@x.com ";
    expect(isPredictionStatusEnabled("juan.k.chacon9729@gmail.com")).toBe(true);
    expect(isPredictionStatusEnabled("BETA@X.COM")).toBe(true);
    expect(isPredictionStatusEnabled("nope@x.com")).toBe(false);
  });

  it("is OFF when creator email is null and the list is specific", () => {
    process.env[ENV_KEY] = "juan@x.com";
    expect(isPredictionStatusEnabled(null)).toBe(false);
    expect(isPredictionStatusEnabled(undefined)).toBe(false);
  });
});
