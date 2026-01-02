import type { Pool } from "pg";

export const migration = {
  name: "add_performance_indexes",
  up: async (pool: Pool) => {
    // Index for compare-prices query (DISTINCT ON pattern)
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instances_compare_query
      ON cloudgpus.instances (gpu_model_id, provider_id, price_per_gpu_hour ASC NULLS LAST)
      WHERE is_active = true;
    `);

    // Index for price history aggregation
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_gpu_agg
      ON cloudgpus.price_history (gpu_model_id, recorded_at)
      INCLUDE (price_per_gpu_hour, provider_id);
    `);

    // GIN index for region array containment
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instances_regions_gin
      ON cloudgpus.instances USING GIN (available_regions);
    `);

    // Covering index for provider slug lookups
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_slug_covering
      ON cloudgpus.providers (slug)
      INCLUDE (id, name, display_name, reliability_tier, affiliate_url);
    `);

    // Index for instance provider+gpu combinations
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instances_provider_gpu
      ON cloudgpus.instances (provider_id, gpu_model_id)
      WHERE is_active = true;
    `);
  },
  down: async (pool: Pool) => {
    await pool.query("DROP INDEX IF EXISTS cloudgpus.idx_instances_compare_query;");
    await pool.query("DROP INDEX IF EXISTS cloudgpus.idx_price_history_gpu_agg;");
    await pool.query("DROP INDEX IF EXISTS cloudgpus.idx_instances_regions_gin;");
    await pool.query("DROP INDEX IF EXISTS cloudgpus.idx_providers_slug_covering;");
    await pool.query("DROP INDEX IF EXISTS cloudgpus.idx_instances_provider_gpu;");
  },
};
