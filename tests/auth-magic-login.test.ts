import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { hashToken } from "../src/api/lib/token-hash.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

process.env["JWT_SECRET"] = "test-secret";

describe("GET /api/auth/magic-login", () => {
  it("returns an access token for a valid magic token", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const token = "valid-token";
    const tokenHash = hashToken(token);

    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });

        if (sql.includes("FROM cloudgpus.users") && sql.includes("magic_token_hash")) {
          return {
            rows: [
              {
                id: "00000000-0000-0000-0000-0000000000aa",
                email: "test@example.com",
                name: "Test",
                is_verified: false,
                magic_expires_at: future,
                magic_token_hash: tokenHash,
                magic_token: null,
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.includes("UPDATE cloudgpus.users")) {
          return { rows: [], rowCount: 1 };
        }

        if (sql.includes("INSERT INTO cloudgpus.user_sessions")) {
          return { rows: [{ id: "session-1" }], rowCount: 1 };
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
    const res = await request(app).get(`/api/auth/magic-login?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("test@example.com");
    expect(res.body.data.accessToken).toBeTruthy();

    const updateSql = calls.find((c) => c.sql.includes("UPDATE cloudgpus.users"));
    expect(updateSql).toBeTruthy();
  });
});
