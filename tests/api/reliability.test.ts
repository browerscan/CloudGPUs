import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("GET /api/providers/:slug/reliability", () => {
  it("returns 404 when provider is missing", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get("/api/providers/unknown/reliability");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("computes completion rate and badge", async () => {
    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = $1")) {
          expect(params).toEqual(["gcp"]);
          return {
            rows: [
              {
                id: "prov-1",
                slug: "gcp",
                provider_type: "hyperscaler",
                reliability_tier: "enterprise",
                sla_uptime_percent: "99.9",
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.includes("FROM cloudgpus.scrape_jobs")) {
          return {
            rows: [
              {
                total: "20",
                completed: "18",
                failed: "1",
                timeout: "1",
                rate_limited: "0",
                avg_duration_ms: "12000",
              },
            ],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get("/api/providers/google-cloud/reliability");
    expect(res.status).toBe(200);
    expect(res.body.provider.slug).toBe("gcp");
    expect(res.body.last30d.completionRate).toBeCloseTo(0.9, 5);
    expect(res.body.score.badge).toBe("yellow");
    expect(res.body.score.jobCompletionRate).toBe(90);
  });
});
