import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { getGpuModelBySlug } from "../repositories/gpu-models.js";
import { normalizeGpuSlug } from "../aliases.js";

const compareSchema = z
  .object({
    // Accept both 'gpu' and 'gpuSlug' as query parameter names
    gpu: z.string().min(1).optional(),
    gpuSlug: z.string().min(1).optional(),
    tier: z.enum(["enterprise", "standard", "community"]).optional(),
    includeSpot: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((v): boolean | undefined => {
        if (typeof v === "boolean") return v;
        if (v === "true" || v === "1") return true;
        if (v === "false" || v === "0") return false;
        return undefined;
      }),
    maxPrice: z.coerce.number().positive().optional(),
  })
  .refine((data) => !!(data.gpu || data.gpuSlug), {
    message: "Either 'gpu' or 'gpuSlug' query parameter is required",
    path: ["gpu"],
  })
  .transform((data) => ({
    // Normalize: use 'gpu' if provided, otherwise 'gpuSlug'
    gpuSlug: data.gpu ?? data.gpuSlug ?? "",
    tier: data.tier,
    includeSpot: data.includeSpot,
    maxPrice: data.maxPrice,
  }));

export function comparePricesHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = compareSchema.safeParse(req.query);
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
      provider_display_name: string;
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
        p.display_name AS provider_display_name,
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

    const numericPrices = rows.rows
      .map((r) => Number(r.on_demand ?? (includeSpot ? r.spot : null) ?? NaN))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    const median = numericPrices.length
      ? numericPrices[Math.floor(numericPrices.length / 2)]!
      : null;

    res.json({
      gpu,
      prices: rows.rows.map((r) => ({
        provider: {
          slug: r.provider_slug,
          name: r.provider_name,
          displayName: r.provider_display_name,
          reliabilityTier: r.provider_reliability_tier,
          affiliateUrl: r.affiliate_url,
        },
        instance: {
          instanceType: r.instance_type,
          gpuCount: r.gpu_count,
          vcpuCount: r.vcpu_count,
          ramGb: r.ram_gb,
          networkBandwidthGbps: r.network_bandwidth_gbps ? Number(r.network_bandwidth_gbps) : null,
          hasNvlink: r.has_nvlink ?? null,
          hasInfiniband: r.has_infiniband ?? null,
          infinibandBandwidthGbps: r.infiniband_bandwidth_gbps,
          billingIncrementSeconds: r.billing_increment_seconds,
          minRentalHours: r.min_rental_hours,
          regions: r.available_regions ?? null,
        },
        onDemand: Number(r.on_demand),
        spot: includeSpot && r.spot ? Number(r.spot) : null,
        availability: r.availability_status,
        lastUpdated: r.last_scraped_at,
      })),
      stats: {
        min: numericPrices.length ? numericPrices[0]! : null,
        max: numericPrices.length ? numericPrices[numericPrices.length - 1]! : null,
        median,
        providerCount: new Set(rows.rows.map((r) => r.provider_slug)).size,
      },
      generatedAt: new Date().toISOString(),
    });
  };
}
