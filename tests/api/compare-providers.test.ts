import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("GET /api/compare-providers", () => {
  it("validates query shape", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get("/api/compare-providers");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("returns 400 when providers are the same", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get("/api/compare-providers?providers=runpod,runpod");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("different");
  });

  it("compares providers and returns verdict", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = ANY")) {
          return {
            rows: [
              {
                id: "p1",
                slug: "lambda-labs",
                name: "Lambda",
                display_name: "Lambda",
                provider_type: "specialized_neocloud",
                reliability_tier: "enterprise",
                website_url: "https://lambda.ai",
                pricing_url: null,
                docs_url: null,
                affiliate_url: "https://example.com/aff",
              },
              {
                id: "p2",
                slug: "runpod",
                name: "RunPod",
                display_name: "RunPod",
                provider_type: "marketplace",
                reliability_tier: "standard",
                website_url: "https://runpod.io",
                pricing_url: null,
                docs_url: null,
                affiliate_url: "https://example.com/aff2",
              },
            ],
            rowCount: 2,
          };
        }

        if (sql.includes("FROM cloudgpus.instances i") && sql.includes("GROUP BY i.provider_id")) {
          return {
            rows: [
              {
                provider_id: "p1",
                gpu_model_id: "g1",
                gpu_slug: "h100-sxm",
                gpu_name: "H100",
                min_on_demand: "2.0",
                min_spot: null,
                last_updated: "2025-12-31T00:00:00Z",
              },
              {
                provider_id: "p2",
                gpu_model_id: "g1",
                gpu_slug: "h100-sxm",
                gpu_name: "H100",
                min_on_demand: "3.0",
                min_spot: null,
                last_updated: "2025-12-31T00:00:00Z",
              },
              {
                provider_id: "p1",
                gpu_model_id: "g2",
                gpu_slug: "a100-80gb",
                gpu_name: "A100",
                min_on_demand: "1.0",
                min_spot: null,
                last_updated: "2025-12-31T00:00:00Z",
              },
            ],
            rowCount: 3,
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

    const res = await request(app).get("/api/compare-providers?providers=lambda-labs,runpod");
    expect(res.status).toBe(200);
    expect(res.body.provider1.slug).toBe("lambda-labs");
    expect(res.body.provider2.slug).toBe("runpod");
    expect(res.body.commonGpus).toHaveLength(1);
    expect(res.body.commonGpus[0].gpu.slug).toBe("h100-sxm");
    expect(res.body.verdict.cheaper).toBe("lambda-labs");
    expect(res.body.verdict.moreGpus).toBe("lambda-labs");
  });
});
