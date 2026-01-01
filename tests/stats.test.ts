import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import type { Redis } from "ioredis";
import type { Pool } from "pg";

describe("GET /api/stats/cheapest", () => {
  it("returns cached stats from Redis when present", async () => {
    const cached = JSON.stringify({ generatedAt: "now", items: [] });
    const redis = {
      status: "ready",
      get: async () => cached,
    } as unknown as Redis;

    const pool = {} as unknown as Pool;

    const app = createApp({ pool, redis });
    const res = await request(app).get("/api/stats/cheapest");
    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("HIT");
    expect(res.body).toEqual({ generatedAt: "now", items: [] });
  });

  it("queries the DB and caches when missing", async () => {
    const redisCalls: Array<{ key: string; value: string }> = [];
    const redis = {
      status: "ready",
      get: async () => null,
      set: async (key: string, value: string) => {
        redisCalls.push({ key, value });
        return "OK";
      },
    } as unknown as Redis;

    const pool = {
      query: async () => ({
        rows: [
          {
            gpu_slug: "h100-sxm",
            gpu_name: "NVIDIA H100 SXM",
            cheapest_provider: "lambda-labs",
            cheapest_price_per_gpu_hour: "2.5",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const app = createApp({ pool, redis });
    const res = await request(app).get("/api/stats/cheapest");
    expect(res.status).toBe(200);
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({
        gpuSlug: "h100-sxm",
        cheapestProvider: "lambda-labs",
        cheapestPricePerGpuHour: 2.5,
      }),
    );
    expect(redisCalls[0]?.key).toBe("stats:cheapest");
  });
});
