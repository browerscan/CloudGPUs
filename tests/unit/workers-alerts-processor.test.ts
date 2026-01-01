import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

const added: Array<{ queue: string; name: string; data: unknown }> = [];

vi.mock("bullmq", () => {
  class Queue {
    private name: string;
    constructor(name: string) {
      this.name = name;
    }
    async add(name: string, data: unknown) {
      added.push({ queue: this.name, name, data });
      return { id: "job-1" };
    }
    async close() {
      return;
    }
  }
  return { Queue };
});

describe("workers/alerts processor", () => {
  it("returns early when there are no active confirmed subscriptions", async () => {
    vi.resetModules();
    added.length = 0;

    const pool = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    } as unknown as Pool;

    const redis = {} as unknown as Redis;
    const { alertsProcessor } = await import("../../src/workers/alerts/processor.js");
    const run = alertsProcessor({ pool, redis });
    await expect(run({ data: {} } as unknown as Job)).resolves.toEqual({
      ok: true,
      processed: 0,
      notified: 0,
    });
    expect(added).toHaveLength(0);
  });

  it("enqueues an email when price hits target", async () => {
    vi.resetModules();
    added.length = 0;

    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM cloudgpus.price_alert_subscriptions")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "sub-1",
                email: "a@example.com",
                gpu_model_id: "gpu-1",
                provider_id: null,
                target_price_per_gpu_hour: "2.50",
                unsubscribe_token: "unsub",
                gpu_slug: "h100-sxm",
                gpu_name: "NVIDIA H100",
                provider_slug: null,
                provider_display_name: null,
              },
            ],
          };
        }

        if (sql.includes("SELECT MIN(price_per_gpu_hour)")) {
          return { rowCount: 1, rows: [{ min: "2.00" }] };
        }

        if (sql.startsWith("UPDATE cloudgpus.price_alert_subscriptions")) {
          return { rowCount: 1, rows: [] };
        }

        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const redis = {} as unknown as Redis;
    const { alertsProcessor } = await import("../../src/workers/alerts/processor.js");
    const { QUEUES } = await import("../../src/workers/queues.js");
    const run = alertsProcessor({ pool, redis });

    const out = await run({ data: {} } as unknown as Job);
    expect(out).toEqual({ ok: true, processed: 1, notified: 1 });

    expect(added).toHaveLength(1);
    expect(added[0]?.queue).toBe(QUEUES.notifyEmail);
    expect(added[0]?.data).toEqual(expect.objectContaining({ to: "a@example.com" }));
  });
});
