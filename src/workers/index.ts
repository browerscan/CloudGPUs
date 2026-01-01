import { Worker } from "bullmq";
import { createPool } from "../db/pool.js";
import { createRedis } from "../redis/client.js";
import { logger } from "../logger.js";
import { QUEUES } from "./queues.js";
import { pricingFetchProcessor } from "./pricing/processor.js";
import { pricingAggregateProcessor } from "./pricing/aggregate.js";
import { cleanupProcessor } from "./maintenance/processor.js";
import { ensureRepeatableJobs } from "./scheduler.js";
import { apiSyncProcessor, providerUpdateProcessor } from "./api/processor.js";
import { emailProcessor, slackProcessor, webhookProcessor } from "./notify/processor.js";
import { alertsProcessor } from "./alerts/processor.js";

function parseQueues() {
  const raw = process.env["WORKER_QUEUES"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const pool = createPool();
  const redis = createRedis();
  await redis.connect();

  const queues = parseQueues();
  if (!queues.length) {
    logger.warn("No WORKER_QUEUES configured; exiting");
    return;
  }

  // The "default" worker acts as a scheduler on startup.
  if (queues.includes("default") || queues.includes(QUEUES.maintenance)) {
    await ensureRepeatableJobs({ redis, pool });
  }

  const workers: Worker[] = [];
  const concurrency = Number(process.env["WORKER_CONCURRENCY"] ?? "5");

  for (const q of queues) {
    if (q === QUEUES.pricingFetch) {
      const w = new Worker(q, pricingFetchProcessor({ pool, redis }), {
        connection: redis,
        concurrency,
      });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.pricingAggregate) {
      const w = new Worker(q, pricingAggregateProcessor({ pool, redis }), {
        connection: redis,
        concurrency: 1,
      });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.alerts) {
      const w = new Worker(q, alertsProcessor({ pool, redis }), {
        connection: redis,
        concurrency: 1,
      });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.apiSync) {
      const w = new Worker(q, apiSyncProcessor(pool), { connection: redis, concurrency: 2 });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.providerUpdate) {
      const w = new Worker(q, providerUpdateProcessor(pool), { connection: redis, concurrency: 1 });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.notifySlack) {
      const w = new Worker(q, slackProcessor(), { connection: redis, concurrency: 5 });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.notifyWebhook) {
      const w = new Worker(q, webhookProcessor(), { connection: redis, concurrency: 5 });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.notifyEmail) {
      const w = new Worker(q, emailProcessor(), { connection: redis, concurrency: 5 });
      attachLogging(w, q);
      workers.push(w);
      continue;
    }

    if (q === QUEUES.cleanup || q === "default" || q === QUEUES.maintenance) {
      const w = new Worker(QUEUES.cleanup, cleanupProcessor(pool), {
        connection: redis,
        concurrency: 1,
      });
      attachLogging(w, QUEUES.cleanup);
      workers.push(w);
      continue;
    }

    logger.warn({ queue: q }, "Queue configured but no processor implemented yet");
  }

  logger.info({ queues }, "Workers running");

  const shutdown = async () => {
    logger.info("Shutting down workers...");
    await Promise.allSettled(workers.map((w) => w.close()));
    await redis.quit();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function attachLogging(worker: Worker, queue: string) {
  worker.on("completed", (job) => logger.info({ queue, jobId: job.id }, "job completed"));
  worker.on("failed", (job, err) => logger.error({ queue, jobId: job?.id, err }, "job failed"));
}

main().catch((err) => {
  logger.error({ err }, "Worker boot failed");
  process.exit(1);
});
