import type { Request, Response } from "express";
import type { Redis } from "ioredis";
import type { Pool } from "pg";

export function cheapestStatsHandler(args: { pool: Pool; redis: Redis }) {
  return async (_req: Request, res: Response) => {
    // Caching is handled by cacheGetJson middleware in routes.ts
    const dbRes = await args.pool.query<{
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
          AND i.price_per_gpu_hour IS NOT NULL
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

    res.json({
      generatedAt: new Date().toISOString(),
      items: dbRes.rows.map((r) => ({
        gpuSlug: r.gpu_slug,
        gpuName: r.gpu_name,
        cheapestProvider: r.cheapest_provider,
        cheapestPricePerGpuHour: Number(r.cheapest_price_per_gpu_hour),
      })),
    });
  };
}
