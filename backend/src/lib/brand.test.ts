import { describe, it, expect } from "vitest";
import { BRAND } from "./brand";

describe("BRAND constants", () => {
  it("has a name", () => {
    expect(BRAND.name).toBe("Picks4All");
  });

  it("has a valid domain", () => {
    expect(BRAND.domain).toBe("picks4all.com");
    expect(BRAND.domain).toMatch(/^[a-z0-9-]+\.[a-z]{2,}$/);
  });

  it("has a primary color as valid hex", () => {
    expect(BRAND.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has a primaryLight color as valid hex", () => {
    expect(BRAND.primaryLight).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has a primaryDark color as valid hex", () => {
    expect(BRAND.primaryDark).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has a secondary color as valid hex", () => {
    expect(BRAND.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has an accent color as valid hex", () => {
    expect(BRAND.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has a gradient string starting with linear-gradient", () => {
    expect(BRAND.gradient).toMatch(/^linear-gradient\(/);
  });

  it("has a gradientAlt string starting with linear-gradient", () => {
    expect(BRAND.gradientAlt).toMatch(/^linear-gradient\(/);
  });

  it("has text colors as valid hex", () => {
    expect(BRAND.text).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(BRAND.textMuted).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has background and card colors as valid hex", () => {
    expect(BRAND.background).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(BRAND.card).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("exports all expected keys", () => {
    const expectedKeys = [
      "name", "domain", "primary", "primaryLight", "primaryDark",
      "secondary", "accent", "gradient", "gradientAlt",
      "text", "textMuted", "background", "card",
    ];
    for (const key of expectedKeys) {
      expect(BRAND).toHaveProperty(key);
    }
  });
});
