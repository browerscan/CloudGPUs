import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import os from "node:os";
import { getEnv } from "../../env.js";
import { Queue } from "bullmq";
import { QUEUES } from "../../workers/queues.js";

export function healthHandler(args: { pool: Pool; redis: Redis }) {
  return async (_req: Request, res: Response) => {
    const env = getEnv();
    const startedAt = Date.now();

    if (env.NODE_ENV === "test") {
      res.status(200).json({
        ok: true,
        service: "cloudgpus-api",
        strict: false,
        dependencies: [],
        timingMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const dependency: { name: string; ok: boolean; error?: string }[] = [];

    const strict = env.HEALTHCHECK_STRICT;

    try {
      await args.pool.query("SELECT 1");
      dependency.push({ name: "postgres", ok: true });
    } catch (e) {
      dependency.push({ name: "postgres", ok: false, error: (e as Error).message });
    }

    try {
      if (args.redis.status !== "ready") await args.redis.connect();
      await args.redis.ping();
      dependency.push({ name: "redis", ok: true });
    } catch (e) {
      dependency.push({ name: "redis", ok: false, error: (e as Error).message });
    }

    const ok = dependency.every((d) => d.ok);
    const status = strict && !ok ? 503 : 200;

    let queueDepth: Record<string, unknown> | null = null;
    try {
      const names = [
        QUEUES.pricingFetch,
        QUEUES.pricingAggregate,
        QUEUES.alerts,
        QUEUES.notifySlack,
        QUEUES.notifyEmail,
        QUEUES.notifyWebhook,
        QUEUES.cleanup,
        QUEUES.browserScrape,
        QUEUES.screenshot,
      ];

      const out: Record<string, unknown> = {};
      const queues = names.map((name) => new Queue(name, { connection: args.redis }));

      const counts = await Promise.allSettled(
        queues.map((q) => q.getJobCounts("waiting", "active", "delayed", "failed")),
      );

      for (let i = 0; i < names.length; i++) {
        const count = counts[i];
        if (count?.status === "fulfilled") {
          out[names[i]!] = count.value;
        } else {
          out[names[i]!] = { error: "failed" };
        }
      }

      await Promise.allSettled(queues.map((q) => q.close()));
      queueDepth = out;
    } catch {
      queueDepth = null;
    }

    const dataRes = await args.pool
      .query<{ stale_instances: string; active_instances: string; last_scrape: string | null }>(
        `
        SELECT
          count(*) FILTER (WHERE is_active = true AND last_scraped_at < NOW() - INTERVAL '24 hours')::text AS stale_instances,
          count(*) FILTER (WHERE is_active = true)::text AS active_instances,
          MAX(last_scraped_at)::text AS last_scrape
        FROM cloudgpus.instances
        `,
      )
      .catch(() => null);

    res.status(status).json({
      ok: strict ? ok : true,
      service: "cloudgpus-api",
      strict,
      dependencies: dependency,
      queues: queueDepth,
      data: dataRes
        ? {
            activeInstances: Number(dataRes.rows[0]?.active_instances ?? 0),
            staleInstances: Number(dataRes.rows[0]?.stale_instances ?? 0),
            lastScrapeAt: dataRes.rows[0]?.last_scrape ?? null,
          }
        : null,
      system: {
        hostname: os.hostname(),
        uptimeSeconds: os.uptime(),
        loadavg: os.loadavg(),
        memory: {
          rssBytes: process.memoryUsage().rss,
          heapUsedBytes: process.memoryUsage().heapUsed,
          heapTotalBytes: process.memoryUsage().heapTotal,
        },
      },
      timingMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  };
}
