/**
 * Tests for shared async utilities.
 *
 * createLimiter is what keeps the admin analytics dashboard from
 * opening more Postgres connections than max_connections allows —
 * the "26 sections at once → FATAL: sorry, too many clients already"
 * incident. The concurrency-ceiling tests below encode that contract.
 */

import { describe, it, expect, vi } from "vitest";
import { fireAndForget, createLimiter } from "./asyncHelpers";

describe("fireAndForget", () => {
  it("logs rejections without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fireAndForget("test-label", Promise.reject(new Error("boom")));
    // Give the rejection handler a tick to run
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith("[test-label] failed:", "boom");
    spy.mockRestore();
  });
});

describe("createLimiter", () => {
  it("never exceeds the concurrency ceiling", async () => {
    const limit = createLimiter(4);
    let active = 0;
    let maxObserved = 0;

    const task = () =>
      limit(async () => {
        active++;
        maxObserved = Math.max(maxObserved, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });

    // 26 tasks — the dashboard's section count, the burst that blew
    // past Postgres max_connections when unbounded.
    await Promise.all(Array.from({ length: 26 }, task));

    expect(maxObserved).toBeLessThanOrEqual(4);
    expect(active).toBe(0);
  });

  it("runs everything and preserves each task's result", async () => {
    const limit = createLimiter(2);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => limit(async () => i * 2)),
    );
    expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });

  it("releases the slot when a task throws, letting queued tasks run", async () => {
    const limit = createLimiter(1);
    const order: string[] = [];

    const failing = limit(async () => {
      order.push("first");
      throw new Error("section failed");
    });
    const queued = limit(async () => {
      order.push("second");
      return "ok";
    });

    await expect(failing).rejects.toThrow("section failed");
    await expect(queued).resolves.toBe("ok");
    expect(order).toEqual(["first", "second"]);
  });

  it("propagates each rejection to its own caller only", async () => {
    const limit = createLimiter(2);
    const outcomes = await Promise.allSettled([
      limit(async () => "a"),
      limit(async () => {
        throw new Error("b failed");
      }),
      limit(async () => "c"),
    ]);
    expect(outcomes[0]).toEqual({ status: "fulfilled", value: "a" });
    expect(outcomes[1]?.status).toBe("rejected");
    expect(outcomes[2]).toEqual({ status: "fulfilled", value: "c" });
  });

  it("with limit 1 executes strictly in FIFO order", async () => {
    const limit = createLimiter(1);
    const order: number[] = [];
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        limit(async () => {
          order.push(i);
          await new Promise((r) => setTimeout(r, 1));
        }),
      ),
    );
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
});
