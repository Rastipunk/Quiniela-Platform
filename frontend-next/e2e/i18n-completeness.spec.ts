import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * i18n Completeness Tests
 *
 * Validates that all three locales (ES, EN, PT) have identical key structures
 * across all message JSON files. Runs purely in Node.js — no browser needed.
 *
 * Checks:
 * 1. All locales have the same set of JSON files
 * 2. Every key in each locale exists in every other locale
 * 3. No empty string values in any locale
 */

const MESSAGES_DIR = path.resolve(__dirname, "../src/messages");
const LOCALES = ["es", "en", "pt"] as const;
type Locale = (typeof LOCALES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively extract all leaf keys from a nested object using dot notation */
function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      keys.push(...getKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Collect all empty-string leaf values from a nested object */
function findEmptyValues(
  obj: Record<string, unknown>,
  prefix: string,
  result: string[],
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`;
    if (typeof value === "string" && value.trim() === "") {
      result.push(fullKey);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      findEmptyValues(value as Record<string, unknown>, fullKey, result);
    }
  }
}

/** Load every JSON file in a locale directory, keyed by namespace */
function loadLocaleMessages(locale: Locale): Record<string, Record<string, unknown>> {
  const dir = path.join(MESSAGES_DIR, locale);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const messages: Record<string, Record<string, unknown>> = {};
  for (const file of files) {
    const ns = file.replace(".json", "");
    messages[ns] = JSON.parse(
      fs.readFileSync(path.join(dir, file), "utf-8"),
    ) as Record<string, unknown>;
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Pre-load all locale data (runs at module evaluation, before any test)
// ---------------------------------------------------------------------------

const allMessages: Record<Locale, Record<string, Record<string, unknown>>> =
  {} as Record<Locale, Record<string, Record<string, unknown>>>;

const allKeys: Record<Locale, Set<string>> = {} as Record<Locale, Set<string>>;

const allFileNames: Record<Locale, string[]> = {} as Record<Locale, string[]>;

for (const locale of LOCALES) {
  allMessages[locale] = loadLocaleMessages(locale);
  allFileNames[locale] = Object.keys(allMessages[locale]).sort();

  const keys = new Set<string>();
  for (const [ns, msgs] of Object.entries(allMessages[locale])) {
    for (const key of getKeys(msgs)) {
      keys.add(`${ns}.${key}`);
    }
  }
  allKeys[locale] = keys;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("i18n completeness", () => {
  // 1. Same set of JSON files across all locales
  test("all locales have the same JSON files", () => {
    expect(
      allFileNames.en,
      `EN files differ from ES.\nES: ${allFileNames.es.join(", ")}\nEN: ${allFileNames.en.join(", ")}`,
    ).toEqual(allFileNames.es);

    expect(
      allFileNames.pt,
      `PT files differ from ES.\nES: ${allFileNames.es.join(", ")}\nPT: ${allFileNames.pt.join(", ")}`,
    ).toEqual(allFileNames.es);
  });

  // 2. Cross-locale key parity (every ordered pair)
  for (const base of LOCALES) {
    for (const target of LOCALES) {
      if (base === target) continue;

      test(`${target.toUpperCase()} has all keys from ${base.toUpperCase()}`, () => {
        const missing: string[] = [];
        for (const key of allKeys[base]) {
          if (!allKeys[target].has(key)) {
            missing.push(key);
          }
        }

        if (missing.length > 0) {
          // Group by namespace for readability
          const grouped: Record<string, string[]> = {};
          for (const key of missing) {
            const ns = key.split(".")[0];
            if (!grouped[ns]) grouped[ns] = [];
            grouped[ns].push(key);
          }
          const report = Object.entries(grouped)
            .map(([ns, keys]) => `  [${ns}]\n${keys.map((k) => `    - ${k}`).join("\n")}`)
            .join("\n");

          expect(
            missing,
            `${missing.length} key(s) in ${base.toUpperCase()} missing from ${target.toUpperCase()}:\n${report}`,
          ).toHaveLength(0);
        }
      });
    }
  }

  // Known intentionally empty values (e.g., dashboard subtitle is not shown)
  const ALLOWED_EMPTY = new Set(["dashboard.subtitle"]);

  // 3. No empty string values per locale
  for (const locale of LOCALES) {
    test(`no empty string values in ${locale.toUpperCase()}`, () => {
      const empty: string[] = [];
      for (const [ns, msgs] of Object.entries(allMessages[locale])) {
        findEmptyValues(msgs, ns, empty);
      }
      // Filter out known allowed empty values
      const actual = empty.filter((k) => !ALLOWED_EMPTY.has(k));

      if (actual.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const key of actual) {
          const ns = key.split(".")[0];
          if (!grouped[ns]) grouped[ns] = [];
          grouped[ns].push(key);
        }
        const report = Object.entries(grouped)
          .map(([ns, keys]) => `  [${ns}]\n${keys.map((k) => `    - ${k}`).join("\n")}`)
          .join("\n");

        expect(
          actual,
          `${actual.length} empty value(s) in ${locale.toUpperCase()}:\n${report}`,
        ).toHaveLength(0);
      }
    });
  }

  // 4. Per-namespace key comparison (granular: one test per file per locale pair)
  for (const ns of allFileNames.es) {
    for (const base of LOCALES) {
      for (const target of LOCALES) {
        if (base === target) continue;

        test(`[${ns}] ${target.toUpperCase()} has all keys from ${base.toUpperCase()}`, () => {
          const baseObj = allMessages[base][ns];
          const targetObj = allMessages[target][ns];

          if (!baseObj || !targetObj) {
            // File-level mismatch caught by the first test; skip here
            return;
          }

          const baseKeys = getKeys(baseObj);
          const targetKeys = new Set(getKeys(targetObj));

          const missing = baseKeys.filter((k) => !targetKeys.has(k));

          expect(
            missing,
            `[${ns}.json] ${missing.length} key(s) in ${base.toUpperCase()} missing from ${target.toUpperCase()}:\n${missing.map((k) => `  - ${k}`).join("\n")}`,
          ).toHaveLength(0);
        });
      }
    }
  }

  // 5. Summary: total key counts per locale (informational — always passes)
  test("key count summary", () => {
    const counts: Record<string, number> = {};
    for (const locale of LOCALES) {
      counts[locale.toUpperCase()] = allKeys[locale].size;
    }
    console.log("i18n key counts:", counts);

    // All locales should have the same total (strict equality)
    const sizes = LOCALES.map((l) => allKeys[l].size);
    expect(
      new Set(sizes).size,
      `Key counts differ across locales: ${JSON.stringify(counts)}`,
    ).toBe(1);
  });
});
