import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

describe("GET /api/affiliate/click", () => {
  it("logs click and redirects to provider URL", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        const entry: { sql: string; params?: unknown[] } = { sql };
        if (params) entry.params = params;
        calls.push(entry);

        if (sql.includes("FROM cloudgpus.providers")) {
          return {
            rows: [
              {
                id: "00000000-0000-0000-0000-000000000001",
                affiliate_url: "https://example.com/aff",
                pricing_url: null,
                website_url: "https://example.com",
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.includes("FROM cloudgpus.gpu_models")) {
          return { rows: [{ id: "00000000-0000-0000-0000-000000000002" }], rowCount: 1 };
        }

        if (sql.includes("INSERT INTO cloudgpus.affiliate_clicks")) {
          return { rows: [{ id: "00000000-0000-0000-0000-0000000000aa" }], rowCount: 1 };
        }

        return { rows: [], rowCount: 1 };
      },
    } as unknown as Pool;

    const redis = {
      status: "ready",
      get: async () => null,
      set: async () => "OK",
    } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get(
      "/api/affiliate/click?provider=lambda-labs&gpu=h100-sxm&utm_source=cloudgpus.io",
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBeTruthy();
    const url = new URL(res.headers.location!);
    expect(`${url.origin}${url.pathname}`).toBe("https://example.com/aff");
    expect(url.searchParams.get("utm_source")).toBe("cloudgpus.io");
    expect(url.searchParams.get("cg_click_id")).toBe("00000000-0000-0000-0000-0000000000aa");
    expect(calls.some((c) => c.sql.includes("INSERT INTO cloudgpus.affiliate_clicks"))).toBe(true);
  });
});
