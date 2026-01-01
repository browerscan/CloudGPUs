import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { normalizeGpuSlug, normalizeProviderSlug } from "../aliases.js";

const schema = z.object({
  gpu: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
});

function csvEscape(value: unknown) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportInstancesCsvHandler(pool: Pool) {
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

    const values: unknown[] = [];
    let where = "WHERE i.is_active = true";

    if (parsed.data.gpu) {
      values.push(normalizeGpuSlug(parsed.data.gpu));
      where += ` AND g.slug = $${values.length}`;
    }

    if (parsed.data.provider) {
      values.push(normalizeProviderSlug(parsed.data.provider));
      where += ` AND p.slug = $${values.length}`;
    }

    values.push(parsed.data.limit);

    const rows = await pool.query<{
      provider_slug: string;
      gpu_slug: string;
      instance_type: string;
      gpu_count: number;
      price_per_hour: string;
      price_per_gpu_hour: string;
      spot_per_gpu_hour: string | null;
      currency: string;
      availability_status: string;
      last_scraped_at: string;
      affiliate_url: string | null;
    }>(
      `
      SELECT
        p.slug AS provider_slug,
        g.slug AS gpu_slug,
        i.instance_type,
        i.gpu_count,
        i.price_per_hour::text,
        i.price_per_gpu_hour::text,
        CASE
          WHEN i.price_per_hour_spot IS NULL THEN NULL
          ELSE (i.price_per_hour_spot / NULLIF(i.gpu_count, 0))::text
        END AS spot_per_gpu_hour,
        i.currency,
        i.availability_status::text,
        i.last_scraped_at::text,
        p.affiliate_url
      FROM cloudgpus.instances i
      JOIN cloudgpus.providers p ON p.id = i.provider_id
      JOIN cloudgpus.gpu_models g ON g.id = i.gpu_model_id
      ${where}
      ORDER BY i.price_per_gpu_hour ASC NULLS LAST
      LIMIT $${values.length}
      `,
      values,
    );

    const header = [
      "provider",
      "gpu",
      "instance_type",
      "gpu_count",
      "price_per_hour",
      "price_per_gpu_hour",
      "spot_price_per_gpu_hour",
      "currency",
      "availability_status",
      "last_scraped_at",
      "affiliate_url",
    ];

    const lines = [header.join(",")];
    for (const r of rows.rows) {
      lines.push(
        [
          r.provider_slug,
          r.gpu_slug,
          r.instance_type,
          r.gpu_count,
          r.price_per_hour,
          r.price_per_gpu_hour,
          r.spot_per_gpu_hour ?? "",
          r.currency,
          r.availability_status,
          r.last_scraped_at,
          r.affiliate_url ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="cloudgpus-instances.csv"`);
    res.status(200).send(lines.join("\n"));
  };
}
