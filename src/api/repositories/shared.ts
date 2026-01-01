import type { Pool } from "pg";
import type { Provider, GpuModel } from "../types.js";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Find provider by slug and throw NotFoundError if not found
 */
export async function findProviderBySlug(pool: Pool, slug: string): Promise<Provider> {
  const res = await pool.query<Provider>(
    `
    SELECT
      id, slug, name, display_name, provider_type, reliability_tier,
      website_url, pricing_url, docs_url, status_page_url,
      has_public_api, supports_spot_instances, supports_reserved_instances,
      available_regions, affiliate_url, sla_uptime_percent,
      last_price_update, created_at, updated_at
    FROM cloudgpus.providers
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );
  const provider = res.rows[0];
  if (!provider) {
    throw new NotFoundError(`Provider not found: ${slug}`);
  }
  return provider;
}

/**
 * Find GPU model by slug and throw NotFoundError if not found
 */
export async function findGpuModelBySlug(pool: Pool, slug: string): Promise<GpuModel> {
  const res = await pool.query<GpuModel>(
    `
    SELECT
      id, slug, name, short_name, architecture, vram_gb, memory_type,
      memory_bandwidth_gbps, tdp_watts,
      is_datacenter, is_consumer, generation_year,
      created_at, updated_at
    FROM cloudgpus.gpu_models
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );
  const gpu = res.rows[0];
  if (!gpu) {
    throw new NotFoundError(`GPU model not found: ${slug}`);
  }
  return gpu;
}

/**
 * Find provider ID by slug (lighter query) and throw NotFoundError if not found
 */
export async function findProviderIdBySlug(pool: Pool, slug: string): Promise<string> {
  const res = await pool.query<{ id: string }>(
    "SELECT id FROM cloudgpus.providers WHERE slug = $1 LIMIT 1",
    [slug],
  );
  const provider = res.rows[0];
  if (!provider) {
    throw new NotFoundError(`Provider not found: ${slug}`);
  }
  return provider.id;
}

/**
 * Find GPU model ID by slug (lighter query) and throw NotFoundError if not found
 */
export async function findGpuModelIdBySlug(pool: Pool, slug: string): Promise<string> {
  const res = await pool.query<{ id: string }>(
    "SELECT id FROM cloudgpus.gpu_models WHERE slug = $1 LIMIT 1",
    [slug],
  );
  const gpu = res.rows[0];
  if (!gpu) {
    throw new NotFoundError(`GPU model not found: ${slug}`);
  }
  return gpu.id;
}
