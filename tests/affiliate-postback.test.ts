import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { resetEnvForTests } from "../src/env.js";

const CLICK_ID = "00000000-0000-0000-0000-0000000000cc";

describe("GET /api/affiliate/postback", () => {
  beforeEach(() => {
    delete process.env["AFFILIATE_POSTBACK_SECRET"];
    resetEnvForTests();
  });

  it("rejects when secret is invalid", async () => {
    process.env["AFFILIATE_POSTBACK_SECRET"] = "secret123";
    resetEnvForTests();

    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get(
      `/api/affiliate/postback?click_id=${CLICK_ID}&revenue=10&secret=wrong`,
    );
    expect(res.status).toBe(401);
  });

  it("records a conversion and does not store the secret in raw_data", async () => {
    process.env["AFFILIATE_POSTBACK_SECRET"] = "secret123";
    resetEnvForTests();

    const calls: Array<{ sql: string; params?: unknown[] }> = [];

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        const entry: { sql: string; params?: unknown[] } = { sql };
        if (params) entry.params = params;
        calls.push(entry);

        if (sql.includes("FROM cloudgpus.affiliate_clicks")) {
          return { rows: [{ provider_id: "00000000-0000-0000-0000-000000000001" }], rowCount: 1 };
        }

        if (sql.includes("INSERT INTO cloudgpus.affiliate_conversions")) {
          return { rows: [{ id: "00000000-0000-0000-0000-0000000000dd" }], rowCount: 1 };
        }

        return { rows: [], rowCount: 1 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).get(
      `/api/affiliate/postback?click_id=${CLICK_ID}&external_id=ext-1&revenue=10&secret=secret123`,
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.conversionId).toBe("00000000-0000-0000-0000-0000000000dd");

    const insert = calls.find((c) => c.sql.includes("INSERT INTO cloudgpus.affiliate_conversions"));
    expect(insert?.params).toBeDefined();
    const params = insert?.params ?? [];
    const rawData = params[8] as Record<string, unknown>;
    expect(rawData).toBeTruthy();
    expect(rawData["secret"]).toBeUndefined();
  });
});
