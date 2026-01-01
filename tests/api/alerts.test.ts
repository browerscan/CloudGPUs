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

describe("price alerts API", () => {
  it("validates subscribe payload", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).post("/api/alerts/subscribe").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("creates a new subscription and enqueues a confirmation email", async () => {
    jobs.length = 0;
    const pool = {
      query: async (sql: string) => {
        if (sql.startsWith("SELECT id, slug, name FROM cloudgpus.gpu_models")) {
          return { rows: [{ id: "gpu-1", slug: "h100-sxm", name: "NVIDIA H100" }], rowCount: 1 };
        }
        if (sql.startsWith("SELECT id FROM cloudgpus.providers")) {
          return { rows: [{ id: "prov-1" }], rowCount: 1 };
        }
        if (
          sql.includes("FROM cloudgpus.price_alert_subscriptions") &&
          sql.includes("confirm_token")
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith("INSERT INTO cloudgpus.price_alert_subscriptions")) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const res = await request(app).post("/api/alerts/subscribe").send({
      email: "a@example.com",
      gpuSlug: "h100",
      providerSlug: "runpod",
      targetPricePerGpuHour: 2.5,
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe("pending_confirmation");
    expect(res.body.confirmToken).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    expect(jobs.length).toBe(1);
    expect(jobs[0]?.queue).toBe("email");
    expect(jobs[0]?.data).toEqual(expect.objectContaining({ to: "a@example.com" }));
  });

  it("confirms and unsubscribes via token endpoints", async () => {
    const pool = {
      query: async (sql: string) => {
        if (
          sql.includes("UPDATE cloudgpus.price_alert_subscriptions s") &&
          sql.includes("RETURNING s.id")
        ) {
          return { rows: [{ id: "sub-1", gpu_slug: "h100-sxm" }], rowCount: 1 };
        }
        if (
          sql.includes("UPDATE cloudgpus.price_alert_subscriptions") &&
          sql.includes("SET is_active = false")
        ) {
          return { rows: [{ id: "sub-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const app = createApp({ pool, redis });

    const confirm = await request(app).get("/api/alerts/confirm?token=confirmtoken");
    expect(confirm.status).toBe(200);
    expect(confirm.body).toEqual({ ok: true, confirmed: true, gpuSlug: "h100-sxm" });

    const unsub = await request(app).get("/api/alerts/unsubscribe?token=unsubtoken");
    expect(unsub.status).toBe(200);
    expect(unsub.body).toEqual({ ok: true, unsubscribed: true });
  });
});
