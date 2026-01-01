import { describe, expect, it } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { pricingAggregateProcessor } from "../../src/workers/pricing/aggregate.js";

describe("workers/pricing aggregate", () => {
  it("writes cheapest stats to Redis", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            gpu_slug: "h100-sxm",
            gpu_name: "NVIDIA H100",
            cheapest_provider: "lambda-labs",
            cheapest_price_per_gpu_hour: "2.5",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const calls: Array<{ key: string; value: string; mode: string; ttl: number }> = [];
    const redis = {
      set: async (key: string, value: string, mode: string, ttl: number) => {
        calls.push({ key, value, mode, ttl });
        return "OK";
      },
    } as unknown as Redis;

    const run = pricingAggregateProcessor({ pool, redis });
    const res = await run({ data: {} } as unknown as Job);
    expect(res).toEqual({ ok: true, count: 1 });
    expect(calls[0]?.key).toBe("stats:cheapest");
    expect(calls[0]?.mode).toBe("EX");
    expect(calls[0]?.ttl).toBe(300);
    expect(JSON.parse(calls[0]!.value)).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            gpuSlug: "h100-sxm",
            cheapestProvider: "lambda-labs",
            cheapestPricePerGpuHour: 2.5,
          }),
        ],
      }),
    );
  });
});
