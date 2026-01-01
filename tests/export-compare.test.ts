import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("GET /api/export/compare.csv", () => {
  it("returns a CSV file for compare-prices output", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("FROM cloudgpus.gpu_models")) {
          return {
            rows: [
              {
                id: "00000000-0000-0000-0000-0000000000b1",
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
                generation_year: 2022,
                created_at: "2025-01-01T00:00:00.000Z",
                updated_at: "2025-01-01T00:00:00.000Z",
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.includes("FROM cloudgpus.instances")) {
          return {
            rows: [
              {
                provider_slug: "lambda-labs",
                provider_name: "Lambda Labs",
                provider_reliability_tier: "enterprise",
                affiliate_url: "https://example.com/aff",
                instance_type: "h100-80gb",
                gpu_count: 1,
                vcpu_count: 32,
                ram_gb: 256,
                network_bandwidth_gbps: "100",
                has_nvlink: true,
                has_infiniband: true,
                infiniband_bandwidth_gbps: 200,
                billing_increment_seconds: 3600,
                min_rental_hours: 1,
                available_regions: ["us-east"],
                on_demand: "2.50",
                spot: "1.75",
                availability_status: "available",
                last_scraped_at: "2025-12-31T00:00:00.000Z",
              },
            ],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get("/api/export/compare.csv?gpuSlug=h100-sxm&includeSpot=true");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("cloudgpus-compare-h100-sxm.csv");

    const text = String(res.text ?? "");
    const [header, row] = text.trim().split("\n");
    expect(header).toContain("provider");
    expect(row).toContain("lambda-labs");
    expect(row).toContain("2.50");
  });
});
