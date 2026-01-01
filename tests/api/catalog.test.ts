import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("API catalog routes", () => {
  it("lists providers with filters + sorting", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(typeof params === "undefined" ? { sql } : { sql, params });

        if (sql.startsWith("SELECT count(*)::text AS count FROM cloudgpus.providers")) {
          return { rows: [{ count: "2" }], rowCount: 1 };
        }

        if (sql.includes("FROM cloudgpus.providers") && sql.includes("LIMIT")) {
          return {
            rows: [
              {
                id: "prov-1",
                slug: "runpod",
                name: "RunPod",
                display_name: "RunPod",
                provider_type: "marketplace",
                reliability_tier: "standard",
                website_url: "https://runpod.io",
                pricing_url: "https://runpod.io/pricing",
                docs_url: "https://docs.runpod.io",
                status_page_url: null,
                has_public_api: true,
                supports_spot_instances: true,
                supports_reserved_instances: false,
                available_regions: ["us-east"],
                affiliate_url: "https://example.com/aff",
                sla_uptime_percent: null,
                last_price_update: null,
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
      "/api/providers?limit=1&page=2&sort=-name&where[provider_type][equals]=marketplace",
    );
    expect(res.status).toBe(200);
    expect(res.body.totalDocs).toBe(2);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.page).toBe(2);
    expect(res.body.docs).toHaveLength(1);
    expect(res.body.docs[0].slug).toBe("runpod");

    const listSql =
      calls.find((c) => c.sql.includes("FROM cloudgpus.providers") && c.sql.includes("LIMIT"))
        ?.sql ?? "";
    expect(listSql).toContain("WHERE provider_type = $1");
    expect(listSql).toContain("ORDER BY name DESC");
  });

  it("gets provider by slug and normalizes aliases", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(typeof params === "undefined" ? { sql } : { sql, params });
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = $1")) {
          return {
            rows: [
              {
                id: "prov-gcp",
                slug: "gcp",
                name: "Google Cloud",
                display_name: "GCP",
                provider_type: "hyperscaler",
                reliability_tier: "enterprise",
                website_url: "https://cloud.google.com",
                pricing_url: null,
                docs_url: "https://cloud.google.com/docs",
                status_page_url: null,
                has_public_api: true,
                supports_spot_instances: true,
                supports_reserved_instances: true,
                available_regions: null,
                affiliate_url: null,
                sla_uptime_percent: null,
                last_price_update: null,
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

    const res = await request(app).get("/api/providers/google-cloud");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("gcp");

    const q = calls.find((c) => c.sql.includes("WHERE slug = $1"));
    expect(q?.params).toEqual(["gcp"]);
  });

  it("lists instances with region filter and depth join fields", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(typeof params === "undefined" ? { sql } : { sql, params });

        if (sql.startsWith("SELECT count(*)::text AS count FROM cloudgpus.instances")) {
          return { rows: [{ count: "1" }], rowCount: 1 };
        }

        if (
          sql.includes("FROM cloudgpus.instances i") &&
          sql.includes("LEFT JOIN cloudgpus.providers")
        ) {
          return {
            rows: [
              {
                id: "inst-1",
                provider_id: "prov-1",
                gpu_model_id: "gpu-1",
                instance_type: "h100-80gb",
                gpu_count: 1,
                vcpu_count: 32,
                ram_gb: 256,
                storage_gb: 0,
                price_per_hour: "2.50",
                price_per_gpu_hour: "2.50",
                price_per_hour_spot: null,
                availability_status: "available",
                is_active: true,
                last_scraped_at: "2025-12-31T00:00:00.000Z",
                updated_at: "2025-12-31T00:00:00.000Z",
                created_at: "2025-12-31T00:00:00.000Z",
                provider_slug: "runpod",
                provider_name: "RunPod",
                provider_display_name: "RunPod",
                provider_reliability_tier: "standard",
                provider_affiliate_url: "https://example.com/aff",
                gpu_slug: "h100-sxm",
                gpu_name: "NVIDIA H100 SXM",
                gpu_short_name: "H100",
                gpu_vram_gb: 80,
                gpu_architecture: "hopper",
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
      "/api/instances?limit=2&page=1&depth=1&region=us-east&where[is_active][equals]=true&sort=price_per_gpu_hour",
    );
    expect(res.status).toBe(200);
    expect(res.body.totalDocs).toBe(1);
    expect(res.body.docs[0].provider_slug).toBe("runpod");

    const listSql =
      calls.find(
        (c) => c.sql.includes("LEFT JOIN cloudgpus.providers") && c.sql.includes("@> ARRAY"),
      )?.sql ?? "";
    expect(listSql).toContain("i.available_regions @> ARRAY[$2]::text[]");
  });
});
