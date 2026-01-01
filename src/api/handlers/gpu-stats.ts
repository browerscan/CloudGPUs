import type { Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import type { Redis } from "ioredis";
import { getGpuModelBySlug } from "../repositories/gpu-models.js";

const STATS_KEY_PREFIX = "gpu-stats:";
const STATS_TTL_SECONDS = 7 * 24 * 60 * 60;

function getRedisKey(slug: string, day: string) {
  return `${STATS_KEY_PREFIX}${slug}:${day}`;
}

async function incrementPageView(redis: Redis, gpuSlug: string) {
  const today = new Date().toISOString().split("T")[0]!;
  const key = getRedisKey(gpuSlug, today);
  await redis.incr(key);
  await redis.expire(key, STATS_TTL_SECONDS);
  return redis.get(key);
}

async function getStatsFromRedis(redis: Redis, gpuSlug: string) {
  const keys: string[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    keys.push(getRedisKey(gpuSlug, date.toISOString().split("T")[0]!));
  }

  if (keys.length === 0) return { viewsLast7Days: 0, mostPopularProvider: null };

  const values = await redis.mget(...keys);
  const viewsLast7Days = values.reduce((sum, v) => sum + parseInt(v || "0", 10), 0);

  const mostPopularProvider = await getMostPopularProvider(redis, gpuSlug);

  return { viewsLast7Days, mostPopularProvider };
}

async function getMostPopularProvider(redis: Redis, gpuSlug: string): Promise<string | null> {
  const clickKey = `gpu-clicks:${gpuSlug}:7d`;
  const providers = await redis.zrevrange(clickKey, 0, 0, "WITHSCORES");
  if (providers.length < 2) return null;
  return providers[0] ?? null;
}

export async function recordGpuView(redis: Redis, gpuSlug: string, providerSlug: string | null) {
  await incrementPageView(redis, gpuSlug);
  if (providerSlug) {
    const clickKey = `gpu-clicks:${gpuSlug}:7d`;
    await redis.zincrby(clickKey, 1, providerSlug);
    await redis.expire(clickKey, 7 * 24 * 60 * 60);
  }
}

export function gpuStatsHandler(deps: { pool: Pool; redis: Redis }) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Missing GPU slug",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const gpu = await getGpuModelBySlug(deps.pool, slug);
    if (!gpu) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "GPU not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const stats = await getStatsFromRedis(deps.redis, slug);
    const clickCount = await getTotalClicks(deps.redis, slug);

    res.json({
      viewsLast7Days: stats.viewsLast7Days,
      mostPopularProvider: stats.mostPopularProvider,
      clickCountLast7Days: clickCount,
    });
  };
}

async function getTotalClicks(redis: Redis, gpuSlug: string): Promise<number> {
  const clickKey = `gpu-clicks:${gpuSlug}:7d`;
  const members = await redis.zrange(clickKey, 0, -1, "WITHSCORES");
  let total = 0;
  for (let i = 1; i < members.length; i += 2) {
    total += parseInt(members[i] || "0", 10);
  }
  return total;
}
