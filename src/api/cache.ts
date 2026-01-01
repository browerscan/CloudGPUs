import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";

interface PendingRequest {
  timestamp: number;
  resolve: (value: string | null) => void;
}

// Map to prevent cache stampede - multiple requests for same key wait for single fetch
const pendingRequests = new Map<string, PendingRequest[]>();
const NEGATIVE_CACHE_TTL = 5; // seconds - cache null/failed DB queries briefly

export function cacheGetJson(args: {
  redis: Redis;
  ttlSeconds: number;
  keyPrefix: string;
  negativeCacheTtl?: number;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${args.keyPrefix}:${req.originalUrl}`;

    try {
      if (args.redis.status !== "ready") await args.redis.connect();
      const cached = await args.redis.get(key);
      if (cached) {
        res.setHeader("x-cache", "HIT");
        res.type("application/json").send(cached);
        return;
      }
    } catch {
      // cache is best-effort
    }

    // Cache stampede protection: check if another request is already fetching this key
    const pending = pendingRequests.get(key);
    if (pending && pending.length > 0) {
      // Wait for the first request to complete
      try {
        const cachedResult = await new Promise<string | null>((resolve) => {
          pending!.push({
            timestamp: Date.now(),
            resolve,
          });
          // Timeout after 5 seconds
          setTimeout(() => resolve(null), 5000);
        });

        if (cachedResult) {
          res.setHeader("x-cache", "HIT-WAIT");
          res.type("application/json").send(cachedResult);
          return;
        }
      } catch {
        // Fall through to fetch
      }
    }

    // Mark this request as the one fetching
    pendingRequests.set(key, [{ timestamp: Date.now(), resolve: () => {} }]);

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const bodyStr = JSON.stringify(body);
      const isNull = body === null;

      Promise.resolve()
        .then(async () => {
          try {
            if (args.redis.status !== "ready") await args.redis.connect();
            // Use negative cache TTL for null results
            const ttl = isNull ? (args.negativeCacheTtl ?? NEGATIVE_CACHE_TTL) : args.ttlSeconds;
            if (ttl > 0) {
              await args.redis.set(key, bodyStr, "EX", ttl);
            }
          } catch {
            // best-effort
          }

          // Resolve any pending waiters
          const waiters = pendingRequests.get(key);
          if (waiters) {
            for (const waiter of waiters) {
              try {
                waiter.resolve(bodyStr);
              } catch {
                // Ignore
              }
            }
            pendingRequests.delete(key);
          }
        })
        .catch(() => {
          // Cleanup on error
          pendingRequests.delete(key);
        });

      res.setHeader("x-cache", "MISS");
      return originalJson(body);
    };

    // Also cleanup on response finish
    res.on("finish", () => {
      const waiters = pendingRequests.get(key);
      if (waiters && waiters.length <= 1) {
        pendingRequests.delete(key);
      }
    });

    next();
  };
}

/**
 * Invalidate a cache key or pattern.
 * Useful for manual cache invalidation after updates.
 */
export async function invalidateCache(
  redis: Redis,
  keyPrefix: string,
  pattern?: string,
): Promise<void> {
  try {
    if (redis.status !== "ready") await redis.connect();

    if (pattern) {
      const stream = redis.scanStream({
        match: `${keyPrefix}:${pattern}`,
        count: 100,
      });
      const keys: string[] = [];
      for await (const key of stream) {
        keys.push(key);
      }
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // No pattern means we need the full key passed separately
      throw new Error("Pattern required for invalidation");
    }
  } catch {
    // Best effort
  }
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateKey(redis: Redis, fullKey: string): Promise<void> {
  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.del(fullKey);
  } catch {
    // Best effort
  }
}
