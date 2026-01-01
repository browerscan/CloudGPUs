-- ============================================================================
-- CloudGPUs.io - Materialized Views for Price Aggregation
-- Version: 1.0.0
-- Created: 2025-12-31
-- Description: Pre-aggregate cheapest GPU prices for faster queries
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

\echo 'Creating materialized view for cheapest GPU prices...'

-- Materialized view: cheapest price per GPU model
DROP MATERIALIZED VIEW IF EXISTS cloudgpus.cheapest_gpu_prices CASCADE;

CREATE MATERIALIZED VIEW cloudgpus.cheapest_gpu_prices AS
SELECT
    gpu_model_id,
    MIN(price_per_gpu_hour) AS cheapest_price_per_gpu,
    MIN(price_per_hour) AS cheapest_price_total,
    ARRAY_AGG(DISTINCT provider_id) FILTER (WHERE price_per_gpu_hour <= MIN(price_per_gpu_hour) * 1.1) AS provider_ids,
    COUNT(*) FILTER (WHERE is_active = true) AS active_instance_count,
    MAX(last_scraped_at) AS last_updated
FROM cloudgpus.instances
WHERE is_active = true
  AND price_per_hour > 0
GROUP BY gpu_model_id
WITH DATA;

-- Unique index for fast lookups and CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_cheapest_gpu_prices_gpu_id
  ON cloudgpus.cheapest_gpu_prices(gpu_model_id);

-- Index for price-based filtering
CREATE INDEX IF NOT EXISTS idx_cheapest_gpu_prices_price
  ON cloudgpus.cheapest_gpu_prices(cheapest_price_per_gpu);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION cloudgpus.refresh_cheapest_prices()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cloudgpus.cheapest_gpu_prices;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON cloudgpus.cheapest_gpu_prices TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cloudgpus.refresh_cheapest_prices() TO service_role;

COMMENT ON MATERIALIZED VIEW cloudgpus.cheapest_gpu_prices IS
  'Pre-aggregated cheapest prices per GPU model. Refresh via cloudgpus.refresh_cheapest_prices()';

COMMENT ON FUNCTION cloudgpus.refresh_cheapest_prices() IS
  'Refresh the cheapest_gpu_prices materialized view without blocking reads';

COMMIT;

\echo 'Materialized view created successfully!'
