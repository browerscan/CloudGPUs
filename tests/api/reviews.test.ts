import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

const jobs: Array<{ queue: string; name: string; data: unknown }> = [];

vi.mock("bullmq", () => {
  class Queue {
    private name: string;
    constructor(name: string) {
      this.name = name;
    }
    async add(name: string, data: unknown) {
      jobs.push({ queue: this.name, name, data });
      return { id: "job-1" };
    }
    async close() {
      return;
    }
  }
  return { Queue };
});

describe("provider reviews API", () => {
  it("lists published reviews", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.startsWith("SELECT id FROM cloudgpus.providers")) {
          return { rows: [{ id: "prov-1" }], rowCount: 1 };
        }
        if (sql.includes("FROM cloudgpus.provider_reviews")) {
          return {
            rows: [
              {
                id: "r1",
                rating: 5,
                title: "Great",
                body: "A".repeat(30),
                author_name: "Alice",
                created_at: "2025-12-01T00:00:00Z",
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

    const res = await request(app).get("/api/providers/runpod/reviews");
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0]).toEqual(
      expect.objectContaining({ id: "r1", rating: 5, title: "Great", authorName: "Alice" }),
    );
  });

  it("creates a review and enqueues a Slack moderation notification", async () => {
    jobs.length = 0;
    const pool = {
      query: async (sql: string) => {
        if (sql.startsWith("SELECT id FROM cloudgpus.providers")) {
          return { rows: [{ id: "prov-1" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO cloudgpus.provider_reviews")) {
          return { rows: [{ id: "rev-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).post("/api/providers/runpod/reviews").send({
      rating: 5,
      body: "This provider was reliable and fast for my workload.",
      authorName: "Alice",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, id: "rev-1", published: false });
    expect(jobs).toEqual([expect.objectContaining({ queue: "slack", name: "slack" })]);
  });
});
