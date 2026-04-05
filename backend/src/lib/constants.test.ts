import { describe, it, expect } from "vitest";
import {
  MS,
  TOKEN_EXPIRY_MS,
  CRYPTO_BYTES,
  MATCH_SYNC,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  USER_RULES,
  PAGINATION,
  RESERVED_USERNAMES,
  PLACEHOLDER_TEAM_PREFIXES,
} from "./constants";

describe("constants", () => {
  // ── MS ────────────────────────────────────────────────────

  describe("MS (time constants)", () => {
    it("SECOND is 1000", () => {
      expect(MS.SECOND).toBe(1_000);
    });

    it("MINUTE is 60 seconds", () => {
      expect(MS.MINUTE).toBe(60_000);
    });

    it("HOUR is 60 minutes", () => {
      expect(MS.HOUR).toBe(3_600_000);
    });

    it("DAY is 24 hours", () => {
      expect(MS.DAY).toBe(86_400_000);
    });

    it("values are internally consistent", () => {
      expect(MS.MINUTE).toBe(60 * MS.SECOND);
      expect(MS.HOUR).toBe(60 * MS.MINUTE);
      expect(MS.DAY).toBe(24 * MS.HOUR);
    });
  });

  // ── TOKEN_EXPIRY_MS ──────────────────────────────────────

  describe("TOKEN_EXPIRY_MS", () => {
    it("EMAIL_VERIFICATION is 1 day", () => {
      expect(TOKEN_EXPIRY_MS.EMAIL_VERIFICATION).toBe(MS.DAY);
    });

    it("PASSWORD_RESET is 1 hour", () => {
      expect(TOKEN_EXPIRY_MS.PASSWORD_RESET).toBe(MS.HOUR);
    });

    it("CORPORATE_INVITE is 30 days", () => {
      expect(TOKEN_EXPIRY_MS.CORPORATE_INVITE).toBe(30 * MS.DAY);
    });

    it("POOL_INVITE_DEFAULT is 30 days", () => {
      expect(TOKEN_EXPIRY_MS.POOL_INVITE_DEFAULT).toBe(30 * MS.DAY);
    });

    it("all values are positive numbers", () => {
      for (const val of Object.values(TOKEN_EXPIRY_MS)) {
        expect(val).toBeGreaterThan(0);
        expect(typeof val).toBe("number");
      }
    });
  });

  // ── CRYPTO_BYTES ──────────────────────────────────────────

  describe("CRYPTO_BYTES", () => {
    it("TOKEN is 32 bytes", () => {
      expect(CRYPTO_BYTES.TOKEN).toBe(32);
    });

    it("POOL_INVITE_CODE is 6 bytes", () => {
      expect(CRYPTO_BYTES.POOL_INVITE_CODE).toBe(6);
    });

    it("USERNAME_SUFFIX is 3 bytes", () => {
      expect(CRYPTO_BYTES.USERNAME_SUFFIX).toBe(3);
    });

    it("GENERATED_PASSWORD is 12", () => {
      expect(CRYPTO_BYTES.GENERATED_PASSWORD).toBe(12);
    });

    it("all values are positive integers", () => {
      for (const val of Object.values(CRYPTO_BYTES)) {
        expect(val).toBeGreaterThan(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  // ── MATCH_SYNC ────────────────────────────────────────────

  describe("MATCH_SYNC", () => {
    it("FIRST_CHECK_MINUTES defaults to 5", () => {
      expect(MATCH_SYNC.FIRST_CHECK_MINUTES).toBe(5);
    });

    it("FINISH_CHECK_MINUTES defaults to 110", () => {
      expect(MATCH_SYNC.FINISH_CHECK_MINUTES).toBe(110);
    });

    it("FIRST_CHECK_MS is computed from minutes", () => {
      expect(MATCH_SYNC.FIRST_CHECK_MS).toBe(MATCH_SYNC.FIRST_CHECK_MINUTES * MS.MINUTE);
    });

    it("FINISH_CHECK_MS is computed from minutes", () => {
      expect(MATCH_SYNC.FINISH_CHECK_MS).toBe(MATCH_SYNC.FINISH_CHECK_MINUTES * MS.MINUTE);
    });
  });

  // ── Locales ───────────────────────────────────────────────

  describe("SUPPORTED_LOCALES", () => {
    it("contains es, en, pt", () => {
      expect(SUPPORTED_LOCALES).toContain("es");
      expect(SUPPORTED_LOCALES).toContain("en");
      expect(SUPPORTED_LOCALES).toContain("pt");
    });

    it("has exactly 3 locales", () => {
      expect(SUPPORTED_LOCALES).toHaveLength(3);
    });
  });

  describe("DEFAULT_LOCALE", () => {
    it("is 'es'", () => {
      expect(DEFAULT_LOCALE).toBe("es");
    });

    it("is included in SUPPORTED_LOCALES", () => {
      expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
    });
  });

  // ── USER_RULES ────────────────────────────────────────────

  describe("USER_RULES", () => {
    it("USERNAME_CHANGE_COOLDOWN_DAYS is 30", () => {
      expect(USER_RULES.USERNAME_CHANGE_COOLDOWN_DAYS).toBe(30);
    });

    it("MIN_AGE is positive", () => {
      expect(USER_RULES.MIN_AGE).toBeGreaterThan(0);
    });

    it("MIN_AGE is 13", () => {
      expect(USER_RULES.MIN_AGE).toBe(13);
    });

    it("MAX_AGE is greater than MIN_AGE", () => {
      expect(USER_RULES.MAX_AGE).toBeGreaterThan(USER_RULES.MIN_AGE);
    });

    it("MAX_AGE is 120", () => {
      expect(USER_RULES.MAX_AGE).toBe(120);
    });
  });

  // ── PAGINATION ────────────────────────────────────────────

  describe("PAGINATION", () => {
    it("DEFAULT_LIMIT is 50", () => {
      expect(PAGINATION.DEFAULT_LIMIT).toBe(50);
    });

    it("MAX_LIMIT is 100", () => {
      expect(PAGINATION.MAX_LIMIT).toBe(100);
    });

    it("MAX_LIMIT >= DEFAULT_LIMIT", () => {
      expect(PAGINATION.MAX_LIMIT).toBeGreaterThanOrEqual(PAGINATION.DEFAULT_LIMIT);
    });

    it("both values are positive", () => {
      expect(PAGINATION.DEFAULT_LIMIT).toBeGreaterThan(0);
      expect(PAGINATION.MAX_LIMIT).toBeGreaterThan(0);
    });
  });

  // ── RESERVED_USERNAMES ────────────────────────────────────

  describe("RESERVED_USERNAMES", () => {
    it("includes admin, root, system, api, www", () => {
      expect(RESERVED_USERNAMES).toContain("admin");
      expect(RESERVED_USERNAMES).toContain("root");
      expect(RESERVED_USERNAMES).toContain("system");
      expect(RESERVED_USERNAMES).toContain("api");
      expect(RESERVED_USERNAMES).toContain("www");
    });

    it("includes quiniela", () => {
      expect(RESERVED_USERNAMES).toContain("quiniela");
    });

    it("all entries are lowercase strings", () => {
      for (const name of RESERVED_USERNAMES) {
        expect(name).toBe(name.toLowerCase());
        expect(typeof name).toBe("string");
      }
    });
  });

  // ── PLACEHOLDER_TEAM_PREFIXES ─────────────────────────────

  describe("PLACEHOLDER_TEAM_PREFIXES", () => {
    it("contains t_TBD prefix", () => {
      expect(PLACEHOLDER_TEAM_PREFIXES).toContain("t_TBD");
    });

    it("contains winner/runner-up/loser prefixes", () => {
      expect(PLACEHOLDER_TEAM_PREFIXES).toContain("W_");
      expect(PLACEHOLDER_TEAM_PREFIXES).toContain("RU_");
      expect(PLACEHOLDER_TEAM_PREFIXES).toContain("L_");
    });

    it("contains 3rd prefix", () => {
      expect(PLACEHOLDER_TEAM_PREFIXES).toContain("3rd_");
    });
  });
});
