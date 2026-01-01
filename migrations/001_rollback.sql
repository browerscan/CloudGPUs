-- ============================================================================
-- CloudGPUs.io Database Schema ROLLBACK
-- Version: 1.0.0
-- WARNING: This will DELETE ALL DATA in the cloudgpus schema!
--
-- Usage: psql -h supabase-db -U postgres -d postgres -f 001_rollback.sql
-- ============================================================================

\echo '!!! WARNING: This will DELETE ALL CloudGPUs data !!!'
\echo 'Press Ctrl+C within 5 seconds to abort...'
SELECT pg_sleep(5);

\echo 'Starting rollback...'
\timing on

BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_gpu_models_timestamp ON cloudgpus.gpu_models;
DROP TRIGGER IF EXISTS update_providers_timestamp ON cloudgpus.providers;
DROP TRIGGER IF EXISTS update_instances_timestamp ON cloudgpus.instances;
DROP TRIGGER IF EXISTS update_gpu_benchmarks_timestamp ON cloudgpus.gpu_benchmarks;
DROP TRIGGER IF EXISTS update_content_pages_timestamp ON cloudgpus.content_pages;
DROP TRIGGER IF EXISTS compute_instance_price_per_vram ON cloudgpus.instances;
DROP TRIGGER IF EXISTS record_instance_price_history ON cloudgpus.instances;
DROP TRIGGER IF EXISTS track_provider_price_update ON cloudgpus.instances;
DROP TRIGGER IF EXISTS validate_depin_provider_uptime ON cloudgpus.providers;

-- Drop functions
DROP FUNCTION IF EXISTS cloudgpus.update_timestamp();
DROP FUNCTION IF EXISTS cloudgpus.compute_price_per_vram();
DROP FUNCTION IF EXISTS cloudgpus.record_price_history();
DROP FUNCTION IF EXISTS cloudgpus.update_provider_last_price_update();
DROP FUNCTION IF EXISTS cloudgpus.validate_depin_uptime();
DROP FUNCTION IF EXISTS cloudgpus.cleanup_stale_instances();

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS cloudgpus.content_pages;
DROP TABLE IF EXISTS cloudgpus.gpu_benchmarks;
DROP TABLE IF EXISTS cloudgpus.scrape_jobs;
DROP TABLE IF EXISTS cloudgpus.price_history;
DROP TABLE IF EXISTS cloudgpus.instances;
DROP TABLE IF EXISTS cloudgpus.providers;
DROP TABLE IF EXISTS cloudgpus.gpu_models;

-- Drop types
DROP TYPE IF EXISTS cloudgpus.benchmark_workload;
DROP TYPE IF EXISTS cloudgpus.scrape_status;
DROP TYPE IF EXISTS cloudgpus.availability_status;
DROP TYPE IF EXISTS cloudgpus.gpu_architecture;
DROP TYPE IF EXISTS cloudgpus.provider_type;
DROP TYPE IF EXISTS cloudgpus.reliability_tier;

-- Drop schema
DROP SCHEMA IF EXISTS cloudgpus;

COMMIT;

\echo 'Rollback completed. CloudGPUs schema has been removed.'
