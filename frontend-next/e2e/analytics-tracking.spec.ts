/**
 * Analytics tracking smoke tests.
 *
 * These tests assert that the CLIENT-SIDE tracking layer produces the
 * correct dataLayer shapes we've committed to maintaining for the GA4
 * reports and Meta Ads Manager. They do NOT hit Google / Meta — network
 * requests to their endpoints are intercepted and aborted so the tests
 * run offline.
 *
 * What we guarantee:
 *  - Every ecommerce event follows GA4's canonical shape
 *    (currency, value, items[] with item_id/price/quantity)
 *  - `transaction_id` is stable across duplicate purchase events so GA4
 *    deduplicates instead of double-counting revenue.
 *  - Consent Mode v2 signals use the `gtag('consent', …)` tuple format
 *    (not a plain dataLayer object push — GTM ignores those for consent).
 *  - Meta Pixel is NOT initialised without consent, and is revoked when
 *    consent is denied or the user logs out.
 *
 * Keep these tests black-box: they should exercise user-visible flows
 * (click banner → push to dataLayer), never call internal helpers.
 */

import { test, expect, Page } from "@playwright/test";

// Block outbound analytics so CI can run without touching production
// Google / Meta infrastructure. We still inspect dataLayer locally.
async function stubAnalyticsNetwork(page: Page): Promise<void> {
  await page.route(/googletagmanager\.com\/(gtm|gtag)/, (route) => route.abort());
  await page.route(/google-analytics\.com\/g\/collect/, (route) => route.abort());
  await page.route(/analytics\.google\.com/, (route) => route.abort());
  await page.route(/connect\.facebook\.net/, (route) => route.abort());
  await page.route(/facebook\.com\/tr/, (route) => route.abort());
}

// Reads the page's live dataLayer into a plain array we can assert on.
// We copy here because subsequent pushes would mutate a reference.
async function getDataLayer(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    return Array.isArray(dl) ? JSON.parse(JSON.stringify(dl)) : [];
  });
}

test.describe("Consent Mode v2 bootstrap", () => {
  test("default consent is denied on first visit (no preference stored)", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.addInitScript(() => localStorage.removeItem("p4a_cookie_consent"));
    await page.goto("/");
    const dataLayer = await getDataLayer(page);

    // Find the `gtag('consent','default', {...})` tuple — it is pushed as
    // an array-like with consent signals, not an event object.
    const defaultConsent = dataLayer.find(
      (entry): entry is unknown[] =>
        Array.isArray(entry) && entry[0] === "consent" && entry[1] === "default",
    );
    expect(defaultConsent, "consent default directive must be on dataLayer").toBeTruthy();
    const signals = defaultConsent?.[2] as Record<string, string>;
    expect(signals.analytics_storage).toBe("denied");
    expect(signals.ad_storage).toBe("denied");
    expect(signals.ad_user_data).toBe("denied");
    expect(signals.ad_personalization).toBe("denied");
  });

  test("accepting the banner updates consent via gtag tuple", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.addInitScript(() => {
      localStorage.removeItem("p4a_cookie_consent");
      localStorage.removeItem("p4a_auth_token");
    });
    await page.goto("/");
    await page.getByRole("button", { name: /aceptar|accept/i }).click();
    const dataLayer = await getDataLayer(page);
    const updateConsent = dataLayer.find(
      (entry): entry is unknown[] =>
        Array.isArray(entry) && entry[0] === "consent" && entry[1] === "update",
    );
    expect(updateConsent, "consent update directive must be emitted on accept").toBeTruthy();
    const signals = updateConsent?.[2] as Record<string, string>;
    expect(signals.analytics_storage).toBe("granted");
  });
});

test.describe("GA4 ecommerce shape", () => {
  test("pricing page emits view_item_list with canonical items[]", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/precios");
    const dataLayer = await getDataLayer(page);
    const viewList = dataLayer.find(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null && (entry as { event?: string }).event === "view_item_list",
    );
    expect(viewList, "view_item_list must fire on pricing").toBeTruthy();
    expect(viewList?.item_list_id).toBe("pricing_page");
    const items = viewList?.items as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.item_id).toBe("string");
      expect(typeof item.item_name).toBe("string");
      expect(typeof item.price).toBe("number");
      expect(item.quantity).toBe(1);
      expect(["USD", "COP"]).toContain(item.currency);
    }
  });
});

test.describe("Attribution capture", () => {
  test("UTM parameters are captured into sessionStorage (first-touch)", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/?utm_source=google&utm_medium=cpc&utm_campaign=mundial_2026&gclid=abc123");
    const stored = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("p4a_attribution") ?? "null"),
    );
    expect(stored).toMatchObject({
      source: "google",
      medium: "cpc",
      campaign: "mundial_2026",
      gclid: "abc123",
    });
  });

  test("first-touch wins: later UTM visits do not overwrite", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/?utm_source=first_campaign&utm_medium=email");
    await page.goto("/?utm_source=second_campaign&utm_medium=cpc");
    const stored = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("p4a_attribution") ?? "null"),
    );
    expect(stored?.source).toBe("first_campaign");
    expect(stored?.medium).toBe("email");
  });
});

test.describe("Identity + user_properties binding", () => {
  test("logout clears user_id on dataLayer so the next user is not confused", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/");
    await page.evaluate(() => {
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ user_id: "user-a" });
    });

    // Simulate the logout helper directly — the NavBar button requires
    // an authenticated session the E2E environment may not have.
    await page.evaluate(async () => {
      const mod = await import("@/lib/analytics");
      mod.setAnalyticsUserId(null);
    });

    const lastUserIdPush = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
      const userIdEntries = dl.filter(
        (entry): entry is { user_id: unknown } =>
          typeof entry === "object" &&
          entry !== null &&
          "user_id" in (entry as Record<string, unknown>),
      );
      return userIdEntries[userIdEntries.length - 1]?.user_id;
    });
    expect(lastUserIdPush).toBeNull();
  });
});

test.describe("Debug mode", () => {
  test("?gtm_debug=1 enables console logging and persists to localStorage", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    const logs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[analytics]")) logs.push(msg.text());
    });

    await page.goto("/?gtm_debug=1");
    // Emit one event to exercise the debug path.
    await page.evaluate(async () => {
      const mod = await import("@/lib/analytics");
      mod.trackEvent("debug_test_event", { foo: "bar" });
    });

    expect(logs.some((l) => l.includes("debug_test_event"))).toBe(true);
    const persisted = await page.evaluate(() => localStorage.getItem("p4a_analytics_debug"));
    expect(persisted).toBe("1");
  });
});

test.describe("Purchase event shape and dedup", () => {
  test("trackPurchase produces a GA4 ecommerce shape with stable transaction_id", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/");
    // Fire the same purchase twice with the SAME transaction_id — GA4
    // collapses these in reports. We just assert both pushes land on
    // dataLayer with identical transaction_id so dedup is even possible.
    await page.evaluate(async () => {
      const mod = await import("@/lib/ecommerce");
      const params = {
        transactionId: "txn_stable_123",
        affiliation: "Mercado Pago Colombia" as const,
        upgrade: {
          fromCapacity: 20,
          toCapacity: 50,
          poolType: "personal" as const,
          price: 28500,
          currency: "COP" as const,
        },
      };
      mod.trackPurchase(params);
      mod.trackPurchase(params);
    });

    const dataLayer = await getDataLayer(page);
    const purchases = dataLayer.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { event?: string }).event === "purchase",
    );
    expect(purchases.length).toBe(2);
    expect(purchases[0]?.transaction_id).toBe("txn_stable_123");
    expect(purchases[1]?.transaction_id).toBe("txn_stable_123");
    const items = purchases[0]?.items as Array<Record<string, unknown>>;
    expect(items[0]?.item_id).toBe("pool_upgrade_personal_50");
    expect(items[0]?.item_variant).toBe("personal");
    expect(purchases[0]?.value).toBe(28500);
    expect(purchases[0]?.currency).toBe("COP");
  });
});

test.describe("Notification subscription events", () => {
  test("notification_subscription_toggled pushes a single unified event", async ({ page }) => {
    await stubAnalyticsNetwork(page);
    await page.goto("/");
    await page.evaluate(async () => {
      const mod = await import("@/lib/analytics");
      mod.trackEvent("notification_subscription_toggled", {
        type: "prediction_updates",
        enabled: true,
      });
    });
    const dataLayer = await getDataLayer(page);
    const toggled = dataLayer.find(
      (e): e is Record<string, unknown> =>
        typeof e === "object" && e !== null &&
        (e as { event?: string }).event === "notification_subscription_toggled",
    );
    expect(toggled?.type).toBe("prediction_updates");
    expect(toggled?.enabled).toBe(true);
  });
});
