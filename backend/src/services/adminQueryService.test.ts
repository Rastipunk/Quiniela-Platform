/**
 * Tests for the admin ad-hoc query service.
 *
 * The DB execution path is integration territory (needs the read-only
 * role); here we exercise the deterministic security core: query
 * validation (single SELECT, no DML, no secret columns) and the result
 * redaction / JSON-safety. These guards are the app-layer half of the
 * defense-in-depth — the Postgres role is the other half.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawUnsafe = vi.fn();
vi.mock("../lib/readonlyDb", () => ({
  getReadonlyDb: () => ({ $queryRawUnsafe: queryRawUnsafe }),
}));

import { validateQuery, runAdminQuery, AdminQueryError } from "./adminQueryService";

describe("validateQuery", () => {
  it("accepts a plain SELECT", () => {
    expect(validateQuery('SELECT id, email FROM "User" LIMIT 5')).toContain("SELECT");
  });

  it("accepts a WITH … SELECT (CTE)", () => {
    const q = 'WITH x AS (SELECT 1 AS n) SELECT * FROM x';
    expect(validateQuery(q)).toContain("WITH");
  });

  it("strips a single trailing semicolon", () => {
    expect(validateQuery("SELECT 1;")).toBe("SELECT 1");
  });

  it("rejects an empty query", () => {
    expect(() => validateQuery("   ")).toThrow(AdminQueryError);
  });

  it("rejects multiple statements", () => {
    expect(() => validateQuery('SELECT 1; SELECT 2')).toThrowError(/single statement/i);
  });

  it("rejects a non-SELECT leading statement", () => {
    expect(() => validateQuery('TABLE "User"')).toThrowError(/only select/i);
  });

  it.each([
    'UPDATE "User" SET email = \'x\'',
    'DELETE FROM "User"',
    'DROP TABLE "User"',
    'INSERT INTO "User" (id) VALUES (\'x\')',
    'TRUNCATE "User"',
    'ALTER TABLE "User" ADD COLUMN x int',
    'GRANT SELECT ON "User" TO foo',
  ])("rejects write/DDL statement: %s", (sql) => {
    expect(() => validateQuery(sql)).toThrowError(/forbidden keyword|only select/i);
  });

  it("does NOT trip the keyword filter on column names containing a keyword", () => {
    // "updatedAtUtc" contains "update"; "createdAtUtc" contains "create".
    const q = 'SELECT "updatedAtUtc", "createdAtUtc" FROM "User"';
    expect(() => validateQuery(q)).not.toThrow();
  });

  it.each(["passwordHash", "resetToken", "emailVerificationToken", "activationToken"])(
    "rejects queries that reference the protected column %s (defeats alias bypass)",
    (col) => {
      expect(() => validateQuery(`SELECT "${col}" AS x FROM "User"`)).toThrowError(
        /protected column/i,
      );
    },
  );

  it("ignores keywords/secret names that appear only inside comments", () => {
    const q = 'SELECT id FROM "User" -- no passwordHash here, no DELETE\n LIMIT 1';
    expect(() => validateQuery(q)).not.toThrow();
  });
});

describe("runAdminQuery", () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
  });

  it("returns rows with BigInt → Number and Date → ISO", async () => {
    queryRawUnsafe.mockResolvedValue([
      { count: 42n, created: new Date("2026-06-11T00:00:00.000Z"), name: "Ana" },
    ]);
    const r = await runAdminQuery("SELECT count, created, name FROM t");
    expect(r.rows[0]).toEqual({
      count: 42,
      created: "2026-06-11T00:00:00.000Z",
      name: "Ana",
    });
    expect(r.rowCount).toBe(1);
    expect(r.truncated).toBe(false);
  });

  it("redacts any sensitive-named key that slips into the result set", async () => {
    // Even if a column named like a secret reaches the result (e.g. via a
    // view or function output the keyword filter didn't catch), redact it.
    queryRawUnsafe.mockResolvedValue([{ id: "u1", passwordHash: "$2b$10$abc" }]);
    const r = await runAdminQuery("SELECT * FROM some_view");
    expect(r.rows[0]).toEqual({ id: "u1", passwordHash: "[REDACTED]" });
  });

  it("truncates to maxRows and flags it", async () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ i }));
    queryRawUnsafe.mockResolvedValue(many);
    const r = await runAdminQuery("SELECT i FROM big");
    expect(r.truncated).toBe(true);
    expect(r.rowCount).toBe(r.maxRows);
    expect(r.rowCount).toBeLessThanOrEqual(1000);
  });

  it("wraps a DB error as AdminQueryError without a stack trace", async () => {
    queryRawUnsafe.mockRejectedValue(new Error("permission denied for table User"));
    await expect(runAdminQuery("SELECT * FROM secret")).rejects.toMatchObject({
      code: "QUERY_FAILED",
      message: expect.stringContaining("permission denied"),
    });
  });

  it("never reaches the DB for an invalid query", async () => {
    await expect(runAdminQuery('DELETE FROM "User"')).rejects.toBeInstanceOf(AdminQueryError);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });
});
