import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { normalizeGpuSlug, normalizeProviderSlug } from "../aliases.js";
import { getGpuModelBySlug } from "../repositories/gpu-models.js";

const schema = z.object({
  gpuSlug: z.string().min(1),
  provider: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export function priceHistoryHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Invalid query",
        details: parsed.error.flatten(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const gpu = await getGpuModelBySlug(pool, normalizeGpuSlug(parsed.data.gpuSlug));
    if (!gpu) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "GPU not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let providerId: string | null = null;
    if (parsed.data.provider) {
      const providerSlug = normalizeProviderSlug(parsed.data.provider);
      const pRes = await pool.query<{ id: string }>(
        "SELECT id FROM cloudgpus.providers WHERE slug = $1 LIMIT 1",
        [providerSlug],
      );
      providerId = pRes.rows[0]?.id ?? null;
      if (!providerId) {
        res.status(404).json({
          status: 404,
          error: "not_found",
          message: "Provider not found",
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const rows = await pool.query<{
      day: string;
      min: string | null;
      avg: string | null;
      max: string | null;
      samples: string;
    }>(
      `
      SELECT
        date_trunc('day', ph.recorded_at)::date::text AS day,
        MIN(ph.price_per_gpu_hour)::text AS min,
        AVG(ph.price_per_gpu_hour)::text AS avg,
        MAX(ph.price_per_gpu_hour)::text AS max,
        COUNT(*)::text AS samples
      FROM cloudgpus.price_history ph
      WHERE ph.gpu_model_id = $1
        AND ph.recorded_at >= NOW() - ($2::int || ' days')::interval
        AND ($3::uuid IS NULL OR ph.provider_id = $3::uuid)
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [gpu.id, parsed.data.days, providerId],
    );

    res.json({
      gpu,
      days: parsed.data.days,
      provider: parsed.data.provider ?? null,
      points: rows.rows.map((r) => ({
        day: r.day,
        min: r.min ? Number(r.min) : null,
        avg: r.avg ? Number(r.avg) : null,
        max: r.max ? Number(r.max) : null,
        samples: Number(r.samples),
      })),
      generatedAt: new Date().toISOString(),
    });
  };
}
