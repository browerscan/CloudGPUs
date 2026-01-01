import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("API pricing data routes", () => {
  it("lists GPU models with filters", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(typeof params === "undefined" ? { sql } : { sql, params });

        if (sql.startsWith("SELECT count(*)::text AS count FROM cloudgpus.gpu_models")) {
          return { rows: [{ count: "1" }], rowCount: 1 };
        }

        if (sql.includes("FROM cloudgpus.gpu_models") && sql.includes("LIMIT")) {
          return {
            rows: [
              {
                id: "gpu-1",
                slug: "h100-sxm",
                name: "NVIDIA H100 SXM",
                short_name: "H100",
                architecture: "hopper",
                vram_gb: 80,
                memory_type: "HBM3",
                memory_bandwidth_gbps: 3350,
                tdp_watts: 700,
                is_datacenter: true,
                is_consumer: false,
                generation_year: 2023,
                created_at: "2025-01-01T00:00:00.000Z",
                updated_at: "2025-01-01T00:00:00.000Z",
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

    const res = await request(app).get(
      "/api/gpu-models?where[vram_gb][less_than]=100&sort=vram_gb&limit=5&page=1",
    );
    expect(res.status).toBe(200);
    expect(res.body.totalDocs).toBe(1);
    expect(res.body.docs[0].slug).toBe("h100-sxm");

    const listSql =
      calls.find((c) => c.sql.includes("FROM cloudgpus.gpu_models") && c.sql.includes("LIMIT"))
        ?.sql ?? "";
    expect(listSql).toContain("WHERE vram_gb < $1");
    expect(listSql).toContain("ORDER BY vram_gb ASC");
  });

  it("returns price history with provider filter and slug aliases", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(typeof params === "undefined" ? { sql } : { sql, params });

        if (sql.includes("FROM cloudgpus.gpu_models") && sql.includes("WHERE slug = $1")) {
          return {
            rows: [
              {
                id: "gpu-1",
                slug: "h100-sxm",
                name: "NVIDIA H100 SXM",
                short_name: "H100",
                architecture: "hopper",
                vram_gb: 80,
                memory_type: "HBM3",
                memory_bandwidth_gbps: 3350,
                tdp_watts: 700,
                is_datacenter: true,
                is_consumer: false,
                generation_year: 2023,
                created_at: "2025-01-01T00:00:00.000Z",
                updated_at: "2025-01-01T00:00:00.000Z",
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.startsWith("SELECT id FROM cloudgpus.providers")) {
          return { rows: [{ id: "prov-gcp" }], rowCount: 1 };
        }

        if (sql.includes("FROM cloudgpus.price_history")) {
          return {
            rows: [{ day: "2025-12-01", min: "2.0", avg: "2.5", max: "3.0", samples: "10" }],
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

    const res = await request(app).get(
      "/api/price-history?gpuSlug=h100&provider=google-cloud&days=30",
    );
    expect(res.status).toBe(200);
    expect(res.body.gpu.slug).toBe("h100-sxm");
    expect(res.body.points[0]).toEqual({
      day: "2025-12-01",
      min: 2,
      avg: 2.5,
      max: 3,
      samples: 10,
    });

    const providerLookup = calls.find((c) =>
      c.sql.startsWith("SELECT id FROM cloudgpus.providers"),
    );
    expect(providerLookup?.params).toEqual(["gcp"]);
  });

  it("exports instances CSV with escaped values", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            provider_slug: "gcp",
            gpu_slug: "h100-sxm",
            instance_type: "h100,80gb",
            gpu_count: 1,
            price_per_hour: "3.00",
            price_per_gpu_hour: "3.00",
            spot_per_gpu_hour: null,
            currency: "USD",
            availability_status: "available",
            last_scraped_at: "2025-12-31T00:00:00.000Z",
            affiliate_url: "https://example.com/?a=1,b=2",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Pool;

    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get(
      "/api/export/instances.csv?gpu=h100&provider=google-cloud&limit=1",
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("provider,gpu,instance_type");
    // csv escaping for commas
    expect(res.text).toContain('"h100,80gb"');
    expect(res.text).toContain('"https://example.com/?a=1,b=2"');
  });
});
