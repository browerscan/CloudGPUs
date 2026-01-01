import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { getGpuModelBySlug } from "../repositories/gpu-models.js";
import { normalizeGpuSlug } from "../aliases.js";

const schema = z.object({
  gpuSlug: z.string().min(1),
  tier: z.enum(["enterprise", "standard", "community"]).optional(),
  includeSpot: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  maxPrice: z.coerce.number().positive().optional(),
});

function csvEscape(value: unknown) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCompareCsvHandler(pool: Pool) {
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

    const { gpuSlug, tier, includeSpot, maxPrice } = parsed.data;
    const gpu = await getGpuModelBySlug(pool, normalizeGpuSlug(gpuSlug));
    if (!gpu) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "GPU not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const values: unknown[] = [gpu.id];
    let where = "WHERE i.gpu_model_id = $1 AND i.is_active = true";
    if (tier) {
      values.push(tier);
      where += ` AND p.reliability_tier = $${values.length}`;
    }
    if (maxPrice) {
      values.push(maxPrice);
      where += ` AND i.price_per_gpu_hour < $${values.length}`;
    }

    const rows = await pool.query<{
      provider_slug: string;
      provider_name: string;
      provider_reliability_tier: string;
      affiliate_url: string | null;
      instance_type: string;
      gpu_count: number;
      vcpu_count: number | null;
      ram_gb: number | null;
      network_bandwidth_gbps: string | null;
      has_nvlink: boolean | null;
      has_infiniband: boolean | null;
      infiniband_bandwidth_gbps: number | null;
      billing_increment_seconds: number | null;
      min_rental_hours: number | null;
      available_regions: string[] | null;
      on_demand: string;
      spot: string | null;
      availability_status: string;
      last_scraped_at: string;
    }>(
      `
      SELECT
        DISTINCT ON (p.id)
        p.slug AS provider_slug,
        p.name AS provider_name,
        p.reliability_tier AS provider_reliability_tier,
        p.affiliate_url,
        i.instance_type,
        i.gpu_count,
        i.vcpu_count,
        i.ram_gb,
        i.network_bandwidth_gbps::text AS network_bandwidth_gbps,
        i.has_nvlink,
        i.has_infiniband,
        i.infiniband_bandwidth_gbps,
        i.billing_increment_seconds,
        i.min_rental_hours,
        i.available_regions,
        i.price_per_gpu_hour AS on_demand,
        CASE
          WHEN i.price_per_hour_spot IS NULL THEN NULL
          ELSE (i.price_per_hour_spot / NULLIF(i.gpu_count, 0))
        END AS spot,
        i.availability_status,
        i.last_scraped_at
      FROM cloudgpus.instances i
      JOIN cloudgpus.providers p ON p.id = i.provider_id
      ${where}
      ORDER BY p.id, i.price_per_gpu_hour ASC NULLS LAST, spot ASC NULLS LAST
      LIMIT 200
      `,
      values,
    );

    const header = [
      "gpu",
      "provider",
      "tier",
      "on_demand_per_gpu_hour",
      "spot_per_gpu_hour",
      "availability",
      "last_updated",
      "instance_type",
      "gpu_count",
      "vcpu_count",
      "ram_gb",
      "network_bandwidth_gbps",
      "has_nvlink",
      "has_infiniband",
      "infiniband_bandwidth_gbps",
      "billing_increment_seconds",
      "min_rental_hours",
      "regions",
      "affiliate_url",
    ];

    const lines = [header.join(",")];
    for (const r of rows.rows) {
      lines.push(
        [
          gpu.slug,
          r.provider_slug,
          r.provider_reliability_tier,
          r.on_demand,
          includeSpot && r.spot ? r.spot : "",
          r.availability_status,
          r.last_scraped_at,
          r.instance_type,
          r.gpu_count,
          r.vcpu_count ?? "",
          r.ram_gb ?? "",
          r.network_bandwidth_gbps ?? "",
          r.has_nvlink ?? "",
          r.has_infiniband ?? "",
          r.infiniband_bandwidth_gbps ?? "",
          r.billing_increment_seconds ?? "",
          r.min_rental_hours ?? "",
          (r.available_regions ?? []).join("|"),
          r.affiliate_url ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader(
      "content-disposition",
      `attachment; filename="cloudgpus-compare-${gpu.slug}.csv"`,
    );
    res.status(200).send(lines.join("\n"));
  };
}
