import { describe, it, expect } from "vitest";
import {
  usernameField,
  passwordField,
  emailField,
  displayNameField,
  poolNameField,
  poolDescriptionField,
  companyNameField,
  welcomeMessageField,
  invitationMessageField,
  templateNameField,
} from "./schemas";

// ─── usernameField ───────────────────────────────────────────

describe("usernameField", () => {
  it("accepts valid alphanumeric username", () => {
    expect(usernameField.parse("john_doe")).toBe("john_doe");
  });

  it("accepts username at min length (3)", () => {
    expect(usernameField.parse("abc")).toBe("abc");
  });

  it("accepts username at max length (20)", () => {
    expect(usernameField.parse("a".repeat(20))).toBe("a".repeat(20));
  });

  it("rejects username shorter than 3 chars", () => {
    expect(() => usernameField.parse("ab")).toThrow();
  });

  it("rejects username longer than 20 chars", () => {
    expect(() => usernameField.parse("a".repeat(21))).toThrow();
  });

  it("rejects username with spaces", () => {
    expect(() => usernameField.parse("john doe")).toThrow();
  });

  it("rejects username with special characters", () => {
    expect(() => usernameField.parse("john@doe")).toThrow();
    expect(() => usernameField.parse("john-doe")).toThrow();
    expect(() => usernameField.parse("john.doe")).toThrow();
  });

  it("accepts underscores", () => {
    expect(usernameField.parse("john_doe_99")).toBe("john_doe_99");
  });

  it("rejects empty string", () => {
    expect(() => usernameField.parse("")).toThrow();
  });
});

// ─── passwordField ───────────────────────────────────────────

describe("passwordField", () => {
  it("accepts valid password at min length (8)", () => {
    expect(passwordField.parse("12345678")).toBe("12345678");
  });

  it("accepts password at max length (128)", () => {
    const longPass = "x".repeat(128);
    expect(passwordField.parse(longPass)).toBe(longPass);
  });

  it("rejects password shorter than 8 chars", () => {
    expect(() => passwordField.parse("1234567")).toThrow();
  });

  it("rejects password longer than 128 chars", () => {
    expect(() => passwordField.parse("x".repeat(129))).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => passwordField.parse("")).toThrow();
  });

  it("accepts special characters in password", () => {
    expect(passwordField.parse("P@ssw0rd!#$")).toBe("P@ssw0rd!#$");
  });
});

// ─── emailField ──────────────────────────────────────────────

describe("emailField", () => {
  it("accepts valid email", () => {
    expect(emailField.parse("user@example.com")).toBe("user@example.com");
  });

  it("rejects email without @", () => {
    expect(() => emailField.parse("userexample.com")).toThrow();
  });

  it("rejects email without domain", () => {
    expect(() => emailField.parse("user@")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => emailField.parse("")).toThrow();
  });

  it("rejects email longer than 255 chars", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(() => emailField.parse(longEmail)).toThrow();
  });

  it("accepts email with subdomains", () => {
    expect(emailField.parse("user@mail.example.co.uk")).toBe("user@mail.example.co.uk");
  });
});

// ─── displayNameField ────────────────────────────────────────

describe("displayNameField", () => {
  it("accepts valid display name", () => {
    expect(displayNameField.parse("John Doe")).toBe("John Doe");
  });

  it("accepts single char name", () => {
    expect(displayNameField.parse("J")).toBe("J");
  });

  it("accepts name at max length (50)", () => {
    expect(displayNameField.parse("a".repeat(50))).toBe("a".repeat(50));
  });

  it("rejects empty string", () => {
    expect(() => displayNameField.parse("")).toThrow();
  });

  it("rejects name longer than 50 chars", () => {
    expect(() => displayNameField.parse("a".repeat(51))).toThrow();
  });
});

// ─── poolNameField ───────────────────────────────────────────

describe("poolNameField", () => {
  it("accepts valid pool name", () => {
    expect(poolNameField.parse("My Pool 2026")).toBe("My Pool 2026");
  });

  it("accepts name at min length (3)", () => {
    expect(poolNameField.parse("abc")).toBe("abc");
  });

  it("accepts name at max length (120)", () => {
    expect(poolNameField.parse("x".repeat(120))).toBe("x".repeat(120));
  });

  it("rejects name shorter than 3 chars", () => {
    expect(() => poolNameField.parse("ab")).toThrow();
  });

  it("rejects name longer than 120 chars", () => {
    expect(() => poolNameField.parse("x".repeat(121))).toThrow();
  });
});

// ─── poolDescriptionField ────────────────────────────────────

describe("poolDescriptionField", () => {
  it("accepts valid description", () => {
    expect(poolDescriptionField.parse("A fun pool for friends")).toBe("A fun pool for friends");
  });

  it("accepts undefined (optional field)", () => {
    expect(poolDescriptionField.parse(undefined)).toBeUndefined();
  });

  it("accepts empty string", () => {
    expect(poolDescriptionField.parse("")).toBe("");
  });

  it("accepts description at max length (500)", () => {
    expect(poolDescriptionField.parse("d".repeat(500))).toBe("d".repeat(500));
  });

  it("rejects description longer than 500 chars", () => {
    expect(() => poolDescriptionField.parse("d".repeat(501))).toThrow();
  });
});

// ─── companyNameField ────────────────────────────────────────

describe("companyNameField", () => {
  it("accepts valid company name", () => {
    expect(companyNameField.parse("Acme Corp")).toBe("Acme Corp");
  });

  it("accepts name at min length (2)", () => {
    expect(companyNameField.parse("AB")).toBe("AB");
  });

  it("rejects single char company name", () => {
    expect(() => companyNameField.parse("A")).toThrow();
  });

  it("accepts name at max length (200)", () => {
    expect(companyNameField.parse("c".repeat(200))).toBe("c".repeat(200));
  });

  it("rejects name longer than 200 chars", () => {
    expect(() => companyNameField.parse("c".repeat(201))).toThrow();
  });
});

// ─── welcomeMessageField ─────────────────────────────────────

describe("welcomeMessageField", () => {
  it("accepts valid welcome message", () => {
    expect(welcomeMessageField.parse("Welcome to our pool!")).toBe("Welcome to our pool!");
  });

  it("accepts undefined (optional)", () => {
    expect(welcomeMessageField.parse(undefined)).toBeUndefined();
  });

  it("accepts message at max length (1000)", () => {
    expect(welcomeMessageField.parse("w".repeat(1000))).toBe("w".repeat(1000));
  });

  it("rejects message longer than 1000 chars", () => {
    expect(() => welcomeMessageField.parse("w".repeat(1001))).toThrow();
  });
});

// ─── invitationMessageField ──────────────────────────────────

describe("invitationMessageField", () => {
  it("accepts valid invitation message", () => {
    expect(invitationMessageField.parse("You are invited!")).toBe("You are invited!");
  });

  it("accepts undefined (optional)", () => {
    expect(invitationMessageField.parse(undefined)).toBeUndefined();
  });

  it("rejects message longer than 1000 chars", () => {
    expect(() => invitationMessageField.parse("i".repeat(1001))).toThrow();
  });
});

// ─── templateNameField ───────────────────────────────────────

describe("templateNameField", () => {
  it("accepts valid template name", () => {
    expect(templateNameField.parse("WC 2026")).toBe("WC 2026");
  });

  it("accepts name at min length (3)", () => {
    expect(templateNameField.parse("abc")).toBe("abc");
  });

  it("accepts name at max length (120)", () => {
    expect(templateNameField.parse("t".repeat(120))).toBe("t".repeat(120));
  });

  it("rejects name shorter than 3 chars", () => {
    expect(() => templateNameField.parse("ab")).toThrow();
  });

  it("rejects name longer than 120 chars", () => {
    expect(() => templateNameField.parse("t".repeat(121))).toThrow();
  });
});
