import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";

/**
 * Cache key patterns used throughout the application
 */
const CACHE_KEYS = {
  PROVIDERS_LIST: "api:v1/providers",
  INSTANCES_LIST: "api:v1/instances",
  GPUS_LIST: "api:v1/gpus",
  STATS_CHEAPEST: "stats:cheapest",
} as const;

/**
 * Invalidate cache keys by pattern using Redis SCAN
 * This is safer than KEYS command for production
 */
async function invalidateCacheByPattern(redis: Redis, pattern: string): Promise<void> {
  try {
    let cursor = "0";
    const keys: string[] = [];

    do {
      const [nextCursor, scannedKeys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      keys.push(...scannedKeys);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await redis.unlink(...keys);
    }
  } catch {
    // Cache invalidation is best-effort; failures should not break the job
  }
}

/**
 * Invalidate all relevant caches after price updates
 */
async function invalidatePriceCaches(redis: Redis): Promise<void> {
  try {
    // Invalidate exact keys
    await redis.unlink(CACHE_KEYS.STATS_CHEAPEST);

    // Invalidate pattern-based caches (using SCAN for safety)
    await invalidateCacheByPattern(redis, "api:v1/providers*");
    await invalidateCacheByPattern(redis, "api:v1/instances*");
    await invalidateCacheByPattern(redis, "api:v1/gpus*");
  } catch {
    // Cache invalidation is best-effort
  }
}

export function pricingAggregateProcessor(args: { pool: Pool; redis: Redis }) {
  return async (_job: Job) => {
    const res = await args.pool.query<{
      gpu_slug: string;
      gpu_name: string;
      cheapest_provider: string;
      cheapest_price_per_gpu_hour: string;
    }>(
      `
      WITH ranked AS (
        SELECT
          g.slug AS gpu_slug,
          g.name AS gpu_name,
          p.slug AS provider_slug,
          i.price_per_gpu_hour,
          ROW_NUMBER() OVER (PARTITION BY g.id ORDER BY i.price_per_gpu_hour ASC NULLS LAST) AS rn
        FROM cloudgpus.instances i
        JOIN cloudgpus.gpu_models g ON g.id = i.gpu_model_id
        JOIN cloudgpus.providers p ON p.id = i.provider_id
        WHERE i.is_active = true
      )
      SELECT
        gpu_slug,
        gpu_name,
        provider_slug AS cheapest_provider,
        price_per_gpu_hour::text AS cheapest_price_per_gpu_hour
      FROM ranked
      WHERE rn = 1
      ORDER BY gpu_slug
      `,
    );

    const payload = {
      generatedAt: new Date().toISOString(),
      items: res.rows.map((r) => ({
        gpuSlug: r.gpu_slug,
        gpuName: r.gpu_name,
        cheapestProvider: r.cheapest_provider,
        cheapestPricePerGpuHour: Number(r.cheapest_price_per_gpu_hour),
      })),
    };

    // Update the cheapest prices cache
    await args.redis.set(CACHE_KEYS.STATS_CHEAPEST, JSON.stringify(payload), "EX", 300);

    // Invalidate related caches to ensure fresh data
    await invalidatePriceCaches(args.redis);

    return { ok: true, count: payload.items.length };
  };
}
