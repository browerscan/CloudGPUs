import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../../src/workers/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("opens after threshold failures and blocks until timeout", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);

    const breaker = new CircuitBreaker({ failureThreshold: 2, openTimeoutMs: 10_000 });

    await expect(breaker.exec(async () => "ok")).resolves.toBe("ok");
    expect(breaker.getState()).toBe("closed");

    await expect(breaker.exec(async () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    expect(breaker.getState()).toBe("closed");

    await expect(breaker.exec(async () => Promise.reject(new Error("boom2")))).rejects.toThrow(
      "boom2",
    );
    expect(breaker.getState()).toBe("open");

    await expect(breaker.exec(async () => "should not run")).rejects.toThrow("circuit_open");

    // After timeout, transitions to half_open and allows a probe call.
    now.mockReturnValue(1_000 + 10_001);
    expect(breaker.getState()).toBe("half_open");
    await expect(breaker.exec(async () => "ok2")).resolves.toBe("ok2");
    expect(breaker.getState()).toBe("closed");
  });
});
