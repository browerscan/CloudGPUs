import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { QUEUES } from "./queues.js";

function hashSlug(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function cadenceHours(args: { providerType: string; reliabilityTier: string }) {
  // Matches docs intent: enterprise faster than community/DePIN.
  if (args.reliabilityTier === "enterprise") return 4;
  if (args.providerType === "depin" || args.reliabilityTier === "community") return 8;
  // Default for regional + marketplace.
  return 6;
}

function cronFor(args: { slug: string; everyHours: number }) {
  const offset = hashSlug(args.slug) % args.everyHours;
  const hours: number[] = [];
  for (let h = offset; h < 24; h += args.everyHours) hours.push(h);
  return `0 ${hours.join(",")} * * *`;
}

export async function ensureRepeatableJobs(args: { redis: Redis; pool: Pool }) {
  const pricingQueue = new Queue(QUEUES.pricingFetch, { connection: args.redis });

  const providersRes = await args.pool.query<{
    slug: string;
    provider_type: string;
    reliability_tier: string;
  }>(
    "SELECT slug, provider_type::text, reliability_tier::text FROM cloudgpus.providers WHERE is_active = true ORDER BY slug",
  );

  for (const p of providersRes.rows) {
    const everyHours = cadenceHours({
      providerType: p.provider_type,
      reliabilityTier: p.reliability_tier,
    });
    const cron = cronFor({ slug: p.slug, everyHours });
    await pricingQueue.add(
      "pricing-fetch",
      { providerSlug: p.slug },
      {
        jobId: `pricing-fetch:${p.slug}`,
        repeat: { pattern: cron },
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
      },
    );
  }

  const aggregateQueue = new Queue(QUEUES.pricingAggregate, { connection: args.redis });
  await aggregateQueue.add(
    "pricing-aggregate",
    {},
    {
      jobId: "pricing-aggregate",
      repeat: { pattern: "5 */1 * * *" },
      removeOnComplete: { age: 24 * 3600, count: 2000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
    },
  );

  const alertsQueue = new Queue(QUEUES.alerts, { connection: args.redis });
  await alertsQueue.add(
    "alerts",
    {},
    {
      jobId: "alerts",
      repeat: { pattern: "10 */1 * * *" },
      removeOnComplete: { age: 24 * 3600, count: 2000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
    },
  );

  const maintenanceQueue = new Queue(QUEUES.cleanup, { connection: args.redis });
  await maintenanceQueue.add(
    "cleanup",
    {},
    {
      jobId: "cleanup",
      repeat: { pattern: "15 */6 * * *" },
      removeOnComplete: { age: 7 * 24 * 3600, count: 2000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
    },
  );

  await pricingQueue.close();
  await aggregateQueue.close();
  await alertsQueue.close();
  await maintenanceQueue.close();
}
