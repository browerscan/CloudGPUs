import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

const adds: Array<{ queue: string; name: string; data: unknown; opts: unknown }> = [];

vi.mock("bullmq", () => {
  class Queue {
    private queueName: string;
    constructor(name: string) {
      this.queueName = name;
    }
    async add(name: string, data: unknown, opts: unknown) {
      adds.push({ queue: this.queueName, name, data, opts });
      return { id: "job-1" };
    }
    async close() {
      return;
    }
  }
  return { Queue };
});

describe("workers/scheduler", () => {
  it("schedules per-provider pricing jobs with tiered cadence", async () => {
    vi.resetModules();
    adds.length = 0;

    const { ensureRepeatableJobs } = await import("../../src/workers/scheduler.js");
    const { QUEUES } = await import("../../src/workers/queues.js");

    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM cloudgpus.providers")) {
          return {
            rows: [
              {
                slug: "lambda-labs",
                provider_type: "specialized_neocloud",
                reliability_tier: "enterprise",
              },
              { slug: "nebius", provider_type: "regional_cloud", reliability_tier: "standard" },
              { slug: "vast-ai", provider_type: "depin", reliability_tier: "community" },
            ],
            rowCount: 3,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const redis = {} as unknown as Redis;
    await ensureRepeatableJobs({ redis, pool });

    const pricingAdds = adds.filter((a) => a.queue === QUEUES.pricingFetch);
    expect(pricingAdds).toHaveLength(3);

    const bySlug = new Map(
      pricingAdds.map((a) => [
        (a.data as { providerSlug: string }).providerSlug,
        a.opts as { jobId: string; repeat: { pattern: string } },
      ]),
    );

    const lambda = bySlug.get("lambda-labs")!;
    expect(lambda.jobId).toBe("pricing-fetch:lambda-labs");
    expect(lambda.repeat.pattern).toMatch(/^0 [0-9,]+ \* \* \*$/);
    expect(lambda.repeat.pattern.split(" ")[1]!.split(",")).toHaveLength(6); // every 4 hours

    const nebius = bySlug.get("nebius")!;
    expect(nebius.jobId).toBe("pricing-fetch:nebius");
    expect(nebius.repeat.pattern.split(" ")[1]!.split(",")).toHaveLength(4); // every 6 hours

    const vast = bySlug.get("vast-ai")!;
    expect(vast.jobId).toBe("pricing-fetch:vast-ai");
    expect(vast.repeat.pattern.split(" ")[1]!.split(",")).toHaveLength(3); // every 8 hours

    // Global periodic jobs
    const aggregate = adds.find((a) => a.queue === QUEUES.pricingAggregate)!;
    expect((aggregate.opts as { jobId: string }).jobId).toBe("pricing-aggregate");

    const alerts = adds.find((a) => a.queue === QUEUES.alerts)!;
    expect((alerts.opts as { jobId: string }).jobId).toBe("alerts");

    const cleanup = adds.find((a) => a.queue === QUEUES.cleanup)!;
    expect((cleanup.opts as { jobId: string }).jobId).toBe("cleanup");
  });
});
