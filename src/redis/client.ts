import { Redis } from "ioredis";
import { getEnv } from "../env.js";

export function createRedis() {
  return new Redis(getEnv().REDIS_URL, {
    // BullMQ requires `maxRetriesPerRequest` to be `null` for blocking commands.
    // Using `null` is also safe for API caching usage.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

export type RedisClient = ReturnType<typeof createRedis>;
