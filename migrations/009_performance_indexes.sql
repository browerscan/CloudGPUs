-- ============================================================================
-- CloudGPUs.io - Performance Indexes Migration
-- Version: 1.0.0
-- Created: 2025-12-31
-- Description: Add composite indexes for common query patterns
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

\echo 'Creating composite performance indexes...'

-- Index for: Find active instances by GPU model, sorted by price
-- Used by: GET /instances?gpu_id=X&sort=price
CREATE INDEX IF NOT EXISTS idx_instances_gpu_active_price
  ON cloudgpus.instances(gpu_model_id, is_active, price_per_gpu_hour)
  WHERE is_active = true;

-- Index for: Find active instances by provider and GPU model
-- Used by: GET /instances?provider_id=X&gpu_id=Y
CREATE INDEX IF NOT EXISTS idx_instances_provider_gpu_active
  ON cloudgpus.instances(provider_id, gpu_model_id, is_active)
  WHERE is_active = true;

-- Index for: Price history time-series queries by GPU model
-- Used by: GET /gpu-models/X/price-history
CREATE INDEX IF NOT EXISTS idx_price_history_gpu_time_desc
  ON cloudgpus.price_history(gpu_model_id, recorded_at DESC);

-- Partial index for cheapest price lookups (active only, filtered by price)
-- Used by: "Find cheapest instance for each GPU"
CREATE INDEX IF NOT EXISTS idx_instances_active_price_asc
  ON cloudgpus.instances(price_per_gpu_hour ASC)
  WHERE is_active = true;

-- Composite index for provider-specific price sorting
CREATE INDEX IF NOT EXISTS idx_instances_provider_price_active
  ON cloudgpus.instances(provider_id, price_per_gpu_hour ASC)
  WHERE is_active = true;

-- Covering index for availability status queries
CREATE INDEX IF NOT EXISTS idx_instances_gpu_availability
  ON cloudgpus.instances(gpu_model_id, availability_status)
  WHERE is_active = true AND availability_status IN ('available', 'limited');

COMMIT;

\echo 'Performance indexes created successfully!'
