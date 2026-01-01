import { createPool } from "./pool.js";
import { GPU_SEED, PROVIDER_SEED } from "./seed-data.js";
import { logger } from "../logger.js";

async function main() {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const gpu of GPU_SEED) {
      await client.query(
        `
        INSERT INTO cloudgpus.gpu_models (
          slug, name, short_name, manufacturer, architecture, vram_gb, memory_type,
          generation_year, is_datacenter, is_consumer
        )
        VALUES ($1,$2,$3,'NVIDIA',$4,$5,$6,$7,$8,$9)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          short_name = EXCLUDED.short_name,
          architecture = EXCLUDED.architecture,
          vram_gb = EXCLUDED.vram_gb,
          memory_type = EXCLUDED.memory_type,
          generation_year = EXCLUDED.generation_year,
          is_datacenter = EXCLUDED.is_datacenter,
          is_consumer = EXCLUDED.is_consumer,
          updated_at = now()
        `,
        [
          gpu.slug,
          gpu.name,
          gpu.shortName,
          gpu.architecture,
          gpu.vramGb,
          gpu.memoryType,
          gpu.generationYear ?? null,
          gpu.isDatacenter ?? true,
          gpu.isConsumer ?? false,
        ],
      );
    }

    for (const p of PROVIDER_SEED) {
      await client.query(
        `
        INSERT INTO cloudgpus.providers (
          slug, name, display_name, provider_type, reliability_tier,
          website_url, pricing_url, docs_url,
          has_public_api, supports_spot_instances,
          supports_reserved_instances,
          available_regions, affiliate_url
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_jsonb($12::text[]),$13)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          provider_type = EXCLUDED.provider_type,
          reliability_tier = EXCLUDED.reliability_tier,
          website_url = EXCLUDED.website_url,
          pricing_url = EXCLUDED.pricing_url,
          docs_url = EXCLUDED.docs_url,
          has_public_api = EXCLUDED.has_public_api,
          supports_spot_instances = EXCLUDED.supports_spot_instances,
          supports_reserved_instances = EXCLUDED.supports_reserved_instances,
          available_regions = EXCLUDED.available_regions,
          affiliate_url = EXCLUDED.affiliate_url,
          updated_at = now()
        `,
        [
          p.slug,
          p.name,
          p.displayName,
          p.providerType,
          p.reliabilityTier,
          p.websiteUrl,
          p.pricingUrl ?? null,
          p.docsUrl ?? null,
          p.hasPublicApi ?? false,
          p.supportsSpot ?? false,
          p.supportsReserved ?? false,
          p.availableRegions ?? null,
          p.affiliateUrl ?? null,
        ],
      );
    }

    await client.query("COMMIT");
    logger.info({ gpus: GPU_SEED.length, providers: PROVIDER_SEED.length }, "Seed complete");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exitCode = 1;
});
