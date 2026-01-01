-- ============================================================================
-- CloudGPUs.io Database Schema Migration
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: GPU cloud pricing aggregation with 40+ providers
--
-- Usage: psql -h supabase-db -U postgres -d postgres -f 001_initial_schema.sql
-- ============================================================================

\echo '=== CloudGPUs.io Schema Migration v1.0.0 ==='
\echo 'Starting migration...'
\timing on

BEGIN;

-- ============================================================================
-- SECTION 1: SCHEMA INITIALIZATION
-- ============================================================================
\echo '  [1/8] Creating schema and extensions...'

CREATE SCHEMA IF NOT EXISTS cloudgpus;
SET search_path TO cloudgpus, public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- SECTION 2: ENUM TYPES
-- ============================================================================
\echo '  [2/8] Creating ENUM types...'

DO $$ BEGIN
    CREATE TYPE cloudgpus.reliability_tier AS ENUM ('enterprise', 'standard', 'community');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cloudgpus.provider_type AS ENUM (
        'specialized_neocloud',
        'hyperscaler',
        'regional_cloud',
        'marketplace',
        'depin',
        'bare_metal'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cloudgpus.gpu_architecture AS ENUM (
        'blackwell',
        'hopper',
        'ada_lovelace',
        'ampere',
        'turing',
        'volta',
        'consumer_blackwell'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cloudgpus.availability_status AS ENUM (
        'available',
        'limited',
        'waitlist',
        'sold_out',
        'contact_sales',
        'deprecated'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cloudgpus.scrape_status AS ENUM (
        'pending',
        'running',
        'completed',
        'failed',
        'timeout',
        'rate_limited'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cloudgpus.benchmark_workload AS ENUM (
        'llm_training',
        'llm_inference',
        'image_generation',
        'video_generation',
        'fine_tuning',
        'embedding',
        'scientific_computing'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 3: CORE TABLES
-- ============================================================================
\echo '  [3/8] Creating core tables...'

-- GPU Models Table
CREATE TABLE IF NOT EXISTS cloudgpus.gpu_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(30) NOT NULL,
    manufacturer VARCHAR(50) NOT NULL DEFAULT 'NVIDIA',
    architecture cloudgpus.gpu_architecture NOT NULL,
    vram_gb SMALLINT NOT NULL,
    memory_type VARCHAR(20) NOT NULL,
    memory_bandwidth_gbps INTEGER,
    tdp_watts SMALLINT,
    fp64_tflops NUMERIC(6,2),
    fp32_tflops NUMERIC(6,2),
    fp16_tflops NUMERIC(7,2),
    fp8_tflops NUMERIC(7,2),
    int8_tops NUMERIC(7,2),
    form_factor VARCHAR(20),
    interconnect VARCHAR(30),
    is_datacenter BOOLEAN NOT NULL DEFAULT true,
    is_consumer BOOLEAN NOT NULL DEFAULT false,
    generation_year SMALLINT,
    description TEXT,
    use_cases TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gpu_vram_positive CHECK (vram_gb > 0),
    CONSTRAINT gpu_bandwidth_positive CHECK (memory_bandwidth_gbps IS NULL OR memory_bandwidth_gbps > 0),
    CONSTRAINT gpu_tdp_positive CHECK (tdp_watts IS NULL OR tdp_watts > 0)
);

CREATE INDEX IF NOT EXISTS idx_gpu_models_architecture ON cloudgpus.gpu_models(architecture);
CREATE INDEX IF NOT EXISTS idx_gpu_models_vram ON cloudgpus.gpu_models(vram_gb);
CREATE INDEX IF NOT EXISTS idx_gpu_models_slug ON cloudgpus.gpu_models(slug);

-- Providers Table
CREATE TABLE IF NOT EXISTS cloudgpus.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    provider_type cloudgpus.provider_type NOT NULL,
    reliability_tier cloudgpus.reliability_tier NOT NULL,
    headquarters_country VARCHAR(3),
    founded_year SMALLINT,
    website_url VARCHAR(255) NOT NULL,
    pricing_url VARCHAR(255),
    docs_url VARCHAR(255),
    status_page_url VARCHAR(255),
    api_base_url VARCHAR(255),
    api_auth_type VARCHAR(50),
    has_public_api BOOLEAN NOT NULL DEFAULT false,
    api_rate_limit_rpm INTEGER,
    affiliate_url VARCHAR(500),
    affiliate_program_name VARCHAR(100),
    affiliate_commission_percent NUMERIC(4,2),
    affiliate_cookie_days SMALLINT,
    sla_uptime_percent NUMERIC(5,2),
    supports_spot_instances BOOLEAN DEFAULT false,
    supports_reserved_instances BOOLEAN DEFAULT false,
    supports_bare_metal BOOLEAN DEFAULT false,
    min_billing_increment_seconds INTEGER,
    available_regions TEXT[],
    description TEXT,
    pros TEXT[],
    cons TEXT[],
    best_for TEXT[],
    logo_url VARCHAR(255),
    brand_color VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_price_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provider_sla_range CHECK (sla_uptime_percent IS NULL OR (sla_uptime_percent >= 0 AND sla_uptime_percent <= 100)),
    CONSTRAINT provider_affiliate_commission_range CHECK (affiliate_commission_percent IS NULL OR (affiliate_commission_percent >= 0 AND affiliate_commission_percent <= 100))
);

CREATE INDEX IF NOT EXISTS idx_providers_type ON cloudgpus.providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_tier ON cloudgpus.providers(reliability_tier);
CREATE INDEX IF NOT EXISTS idx_providers_active ON cloudgpus.providers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_providers_slug ON cloudgpus.providers(slug);

-- Instances Table (Main high-write table)
CREATE TABLE IF NOT EXISTS cloudgpus.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,
    instance_type VARCHAR(100) NOT NULL,
    instance_name VARCHAR(150),
    gpu_count SMALLINT NOT NULL DEFAULT 1,
    price_per_hour NUMERIC(10,4) NOT NULL,
    price_per_hour_spot NUMERIC(10,4),
    price_per_month NUMERIC(12,2),
    price_per_hour_reserved_1y NUMERIC(10,4),
    price_per_hour_reserved_3y NUMERIC(10,4),
    price_per_gpu_hour NUMERIC(10,4) GENERATED ALWAYS AS (price_per_hour / NULLIF(gpu_count, 0)) STORED,
    price_per_vram_gb_hour NUMERIC(10,6),
    price_includes JSONB DEFAULT '{}'::jsonb,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    vcpu_count SMALLINT,
    ram_gb SMALLINT,
    storage_type VARCHAR(30),
    storage_gb INTEGER,
    network_bandwidth_gbps NUMERIC(6,2),
    has_nvlink BOOLEAN DEFAULT false,
    has_infiniband BOOLEAN DEFAULT false,
    infiniband_bandwidth_gbps INTEGER,
    availability_status cloudgpus.availability_status NOT NULL DEFAULT 'available',
    available_regions TEXT[],
    min_rental_hours SMALLINT DEFAULT 1,
    max_rental_hours INTEGER,
    billing_increment_seconds INTEGER DEFAULT 3600,
    setup_fee NUMERIC(10,2) DEFAULT 0,
    instance_url VARCHAR(500),
    raw_data JSONB,
    source_url VARCHAR(500),
    last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scrape_job_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT instances_price_positive CHECK (price_per_hour > 0),
    CONSTRAINT instances_gpu_count_positive CHECK (gpu_count > 0),
    CONSTRAINT instances_spot_price_valid CHECK (price_per_hour_spot IS NULL OR price_per_hour_spot > 0),
    CONSTRAINT instances_provider_type_unique UNIQUE (provider_id, instance_type)
);

CREATE INDEX IF NOT EXISTS idx_instances_gpu_model ON cloudgpus.instances(gpu_model_id);
CREATE INDEX IF NOT EXISTS idx_instances_provider ON cloudgpus.instances(provider_id);
CREATE INDEX IF NOT EXISTS idx_instances_price ON cloudgpus.instances(price_per_gpu_hour);
CREATE INDEX IF NOT EXISTS idx_instances_active ON cloudgpus.instances(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_instances_gpu_price ON cloudgpus.instances(gpu_model_id, price_per_gpu_hour) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_instances_provider_active ON cloudgpus.instances(provider_id, is_active, price_per_gpu_hour) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_instances_last_scraped ON cloudgpus.instances(last_scraped_at);
CREATE INDEX IF NOT EXISTS idx_instances_availability ON cloudgpus.instances(availability_status) WHERE availability_status = 'available';

-- Price History Table (Time-series)
CREATE TABLE IF NOT EXISTS cloudgpus.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES cloudgpus.instances(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,
    price_per_hour NUMERIC(10,4) NOT NULL,
    price_per_gpu_hour NUMERIC(10,4) NOT NULL,
    price_per_hour_spot NUMERIC(10,4),
    availability_status cloudgpus.availability_status NOT NULL,
    gpu_count SMALLINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NOTE: generated columns require IMMUTABLE expressions. `date_trunc(text, timestamptz)` is STABLE
    -- due to timezone semantics, so we normalize to UTC first to keep this IMMUTABLE on Postgres 16+.
    recorded_month DATE GENERATED ALWAYS AS (DATE_TRUNC('month', recorded_at AT TIME ZONE 'UTC')::DATE) STORED
);

CREATE INDEX IF NOT EXISTS idx_price_history_gpu_time ON cloudgpus.price_history(gpu_model_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_provider_time ON cloudgpus.price_history(provider_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_instance_time ON cloudgpus.price_history(instance_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON cloudgpus.price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_history_brin ON cloudgpus.price_history USING BRIN(recorded_at);

-- Scrape Jobs Table (Observability)
CREATE TABLE IF NOT EXISTS cloudgpus.scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    status cloudgpus.scrape_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    instances_found INTEGER DEFAULT 0,
    instances_updated INTEGER DEFAULT 0,
    instances_created INTEGER DEFAULT 0,
    instances_deactivated INTEGER DEFAULT 0,
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count SMALLINT DEFAULT 0,
    request_url VARCHAR(500),
    response_status_code SMALLINT,
    raw_response_size_bytes INTEGER,
    scraper_version VARCHAR(20),
    worker_id VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_provider ON cloudgpus.scrape_jobs(provider_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON cloudgpus.scrape_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_time ON cloudgpus.scrape_jobs(started_at DESC);

-- GPU Benchmarks Table
CREATE TABLE IF NOT EXISTS cloudgpus.gpu_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,
    workload_type cloudgpus.benchmark_workload NOT NULL,
    benchmark_name VARCHAR(100) NOT NULL,
    benchmark_version VARCHAR(20),
    score NUMERIC(12,2),
    score_unit VARCHAR(50),
    latency_ms NUMERIC(10,2),
    throughput NUMERIC(12,2),
    throughput_unit VARCHAR(50),
    batch_size INTEGER,
    precision VARCHAR(10),
    model_name VARCHAR(100),
    framework VARCHAR(50),
    test_date DATE,
    source_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gpu_benchmarks_unique UNIQUE (gpu_model_id, workload_type, benchmark_name, precision)
);

CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_gpu ON cloudgpus.gpu_benchmarks(gpu_model_id);
CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_workload ON cloudgpus.gpu_benchmarks(workload_type);

-- Content Pages Table (pSEO)
CREATE TABLE IF NOT EXISTS cloudgpus.content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(200) NOT NULL UNIQUE,
    page_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    meta_description VARCHAR(320),
    canonical_url VARCHAR(500),
    content_html TEXT,
    content_markdown TEXT,
    structured_data JSONB,
    related_gpu_ids UUID[],
    related_provider_ids UUID[],
    generated_at TIMESTAMPTZ,
    generation_prompt TEXT,
    generation_model VARCHAR(50),
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_type ON cloudgpus.content_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_content_pages_published ON cloudgpus.content_pages(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_content_pages_slug ON cloudgpus.content_pages(slug);

-- ============================================================================
-- SECTION 4: FUNCTIONS AND TRIGGERS
-- ============================================================================
\echo '  [4/8] Creating functions and triggers...'

-- Updated timestamp function
CREATE OR REPLACE FUNCTION cloudgpus.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_gpu_models_timestamp ON cloudgpus.gpu_models;
CREATE TRIGGER update_gpu_models_timestamp
    BEFORE UPDATE ON cloudgpus.gpu_models
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

DROP TRIGGER IF EXISTS update_providers_timestamp ON cloudgpus.providers;
CREATE TRIGGER update_providers_timestamp
    BEFORE UPDATE ON cloudgpus.providers
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

DROP TRIGGER IF EXISTS update_instances_timestamp ON cloudgpus.instances;
CREATE TRIGGER update_instances_timestamp
    BEFORE UPDATE ON cloudgpus.instances
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

DROP TRIGGER IF EXISTS update_gpu_benchmarks_timestamp ON cloudgpus.gpu_benchmarks;
CREATE TRIGGER update_gpu_benchmarks_timestamp
    BEFORE UPDATE ON cloudgpus.gpu_benchmarks
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

DROP TRIGGER IF EXISTS update_content_pages_timestamp ON cloudgpus.content_pages;
CREATE TRIGGER update_content_pages_timestamp
    BEFORE UPDATE ON cloudgpus.content_pages
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

-- Price per VRAM computation
CREATE OR REPLACE FUNCTION cloudgpus.compute_price_per_vram()
RETURNS TRIGGER AS $$
DECLARE
    v_vram_gb SMALLINT;
BEGIN
    SELECT vram_gb INTO v_vram_gb
    FROM cloudgpus.gpu_models
    WHERE id = NEW.gpu_model_id;

    IF v_vram_gb IS NOT NULL AND v_vram_gb > 0 THEN
        NEW.price_per_vram_gb_hour = NEW.price_per_hour / (NEW.gpu_count * v_vram_gb);
    ELSE
        NEW.price_per_vram_gb_hour = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compute_instance_price_per_vram ON cloudgpus.instances;
CREATE TRIGGER compute_instance_price_per_vram
    BEFORE INSERT OR UPDATE OF price_per_hour, gpu_count, gpu_model_id ON cloudgpus.instances
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.compute_price_per_vram();

-- Price history recording
CREATE OR REPLACE FUNCTION cloudgpus.record_price_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR
       OLD.price_per_hour IS DISTINCT FROM NEW.price_per_hour OR
       OLD.price_per_hour_spot IS DISTINCT FROM NEW.price_per_hour_spot OR
       OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN

        INSERT INTO cloudgpus.price_history (
            instance_id, provider_id, gpu_model_id,
            price_per_hour, price_per_gpu_hour, price_per_hour_spot,
            availability_status, gpu_count, recorded_at
        ) VALUES (
            NEW.id, NEW.provider_id, NEW.gpu_model_id,
            NEW.price_per_hour, NEW.price_per_gpu_hour, NEW.price_per_hour_spot,
            NEW.availability_status, NEW.gpu_count, NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS record_instance_price_history ON cloudgpus.instances;
CREATE TRIGGER record_instance_price_history
    AFTER INSERT OR UPDATE ON cloudgpus.instances
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.record_price_history();

-- Provider last update tracker
CREATE OR REPLACE FUNCTION cloudgpus.update_provider_last_price_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cloudgpus.providers
    SET last_price_update = NOW()
    WHERE id = NEW.provider_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_provider_price_update ON cloudgpus.instances;
CREATE TRIGGER track_provider_price_update
    AFTER INSERT OR UPDATE ON cloudgpus.instances
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_provider_last_price_update();

-- DePIN uptime validation
CREATE OR REPLACE FUNCTION cloudgpus.validate_depin_uptime()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.provider_type = 'depin' AND
       NEW.sla_uptime_percent IS NOT NULL AND
       NEW.sla_uptime_percent < 95 THEN
        RAISE NOTICE 'DePIN provider % has uptime below 95%% threshold', NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_depin_provider_uptime ON cloudgpus.providers;
CREATE TRIGGER validate_depin_provider_uptime
    BEFORE INSERT OR UPDATE ON cloudgpus.providers
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.validate_depin_uptime();

-- Stale instance cleanup function
CREATE OR REPLACE FUNCTION cloudgpus.cleanup_stale_instances()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE cloudgpus.instances
    SET is_active = false,
        availability_status = 'deprecated'
    WHERE is_active = true
      AND last_scraped_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: TABLE MAINTENANCE SETTINGS
-- ============================================================================
\echo '  [5/8] Configuring table maintenance...'

ALTER TABLE cloudgpus.instances SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE cloudgpus.price_history SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    fillfactor = 90
);

-- ============================================================================
-- SECTION 6: SEED DATA - GPU MODELS
-- ============================================================================
\echo '  [6/8] Seeding GPU models...'

INSERT INTO cloudgpus.gpu_models (slug, name, short_name, manufacturer, architecture, vram_gb, memory_type, memory_bandwidth_gbps, tdp_watts, fp16_tflops, fp8_tflops, form_factor, interconnect, is_datacenter, is_consumer, generation_year, description, use_cases)
VALUES
    ('b200-sxm', 'NVIDIA B200 SXM', 'B200', 'NVIDIA', 'blackwell', 192, 'HBM3e', 8000, 1000, 4500, 9000, 'SXM', 'NVLink + NVSwitch', true, false, 2024, 'Flagship Blackwell GPU for trillion-parameter model training', ARRAY['LLM Training', 'Scientific Computing', 'Large-Scale AI']),
    ('gb200-nvl', 'NVIDIA GB200 NVL72', 'GB200', 'NVIDIA', 'blackwell', 192, 'HBM3e', 8000, 2700, 5000, 10000, 'NVL', 'NVLink + NVSwitch', true, false, 2024, 'Grace Blackwell Superchip with 72-GPU rack configuration', ARRAY['Frontier AI Training', 'HPC', 'Enterprise AI']),
    ('h200-sxm', 'NVIDIA H200 SXM', 'H200', 'NVIDIA', 'hopper', 141, 'HBM3e', 4800, 700, 1979, 3958, 'SXM5', 'NVLink', true, false, 2024, 'Enhanced Hopper with 141GB HBM3e for large model inference', ARRAY['LLM Inference', 'Fine-tuning', 'RAG']),
    ('h100-sxm', 'NVIDIA H100 SXM', 'H100 SXM', 'NVIDIA', 'hopper', 80, 'HBM3', 3350, 700, 1979, 3958, 'SXM5', 'NVLink', true, false, 2023, 'Industry standard for AI training and inference', ARRAY['LLM Training', 'LLM Inference', 'Fine-tuning', 'Image Generation']),
    ('h100-pcie', 'NVIDIA H100 PCIe', 'H100 PCIe', 'NVIDIA', 'hopper', 80, 'HBM3', 2000, 350, 1513, 3026, 'PCIe', 'PCIe Gen5', true, false, 2023, 'PCIe variant for standard server deployments', ARRAY['Inference', 'Fine-tuning', 'Development']),
    ('l40s', 'NVIDIA L40S', 'L40S', 'NVIDIA', 'ada_lovelace', 48, 'GDDR6', 864, 350, 362, 724, 'PCIe', 'PCIe Gen4', true, false, 2023, 'Versatile datacenter GPU for AI and graphics', ARRAY['Inference', 'Image Generation', 'Video Processing']),
    ('rtx-4090', 'NVIDIA GeForce RTX 4090', 'RTX 4090', 'NVIDIA', 'ada_lovelace', 24, 'GDDR6X', 1008, 450, 330, 660, 'PCIe', 'PCIe Gen4', false, true, 2022, 'Flagship consumer GPU with excellent price-performance', ARRAY['Inference', 'Fine-tuning', 'Image Generation', 'Development']),
    ('rtx-5090', 'NVIDIA GeForce RTX 5090', 'RTX 5090', 'NVIDIA', 'consumer_blackwell', 32, 'GDDR7', 1792, 575, 419, 838, 'PCIe', 'PCIe Gen5', false, true, 2025, 'Next-gen consumer GPU with 32GB GDDR7, competitive with datacenter cards for inference', ARRAY['Inference', 'Fine-tuning', 'Image Generation', 'Video Generation']),
    ('a100-80gb', 'NVIDIA A100 80GB', 'A100 80GB', 'NVIDIA', 'ampere', 80, 'HBM2e', 2039, 400, 312, NULL, 'SXM4', 'NVLink', true, false, 2021, 'Previous generation flagship, still widely available', ARRAY['Training', 'Inference', 'Fine-tuning']),
    ('a100-40gb', 'NVIDIA A100 40GB', 'A100 40GB', 'NVIDIA', 'ampere', 40, 'HBM2e', 1555, 400, 312, NULL, 'SXM4', 'NVLink', true, false, 2020, 'Cost-effective option for medium-sized models', ARRAY['Training', 'Inference', 'Development']),
    ('a10g', 'NVIDIA A10G', 'A10G', 'NVIDIA', 'ampere', 24, 'GDDR6', 600, 150, 125, NULL, 'PCIe', 'PCIe Gen4', true, false, 2021, 'AWS-optimized GPU for inference workloads', ARRAY['Inference', 'Image Generation']),
    ('rtx-3090', 'NVIDIA GeForce RTX 3090', 'RTX 3090', 'NVIDIA', 'ampere', 24, 'GDDR6X', 936, 350, 142, NULL, 'PCIe', 'PCIe Gen4', false, true, 2020, 'Legacy consumer GPU, still popular on DePIN platforms', ARRAY['Inference', 'Fine-tuning', 'Development'])
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    vram_gb = EXCLUDED.vram_gb,
    memory_bandwidth_gbps = EXCLUDED.memory_bandwidth_gbps,
    fp16_tflops = EXCLUDED.fp16_tflops,
    fp8_tflops = EXCLUDED.fp8_tflops,
    updated_at = NOW();

-- ============================================================================
-- SECTION 7: SEED DATA - PROVIDERS
-- ============================================================================
\echo '  [7/8] Seeding providers...'

INSERT INTO cloudgpus.providers (slug, name, display_name, provider_type, reliability_tier, headquarters_country, website_url, pricing_url, docs_url, api_base_url, api_auth_type, has_public_api, sla_uptime_percent, supports_spot_instances, supports_reserved_instances, description, pros, cons, best_for)
VALUES
    ('lambda-labs', 'Lambda Labs', 'Lambda', 'specialized_neocloud', 'enterprise', 'USA', 'https://lambdalabs.com', 'https://lambdalabs.com/service/gpu-cloud#pricing', 'https://docs.lambda.ai/api', 'https://api.lambda.ai/v1', 'bearer_token', true, 99.9, false, true, 'Pioneer in AI cloud computing, known for simplicity and developer focus', ARRAY['Simple REST API', 'Quick provisioning', 'Strong documentation', 'Competitive B200 pricing'], ARRAY['Limited regions', 'No spot instances'], ARRAY['AI startups', 'Research teams', 'Production inference']),
    ('coreweave', 'CoreWeave', 'CoreWeave', 'specialized_neocloud', 'enterprise', 'USA', 'https://coreweave.com', 'https://coreweave.com/pricing', 'https://docs.coreweave.com', 'https://api.coreweave.com', 'kubeconfig', true, 99.99, false, true, 'Kubernetes-native GPU cloud serving OpenAI, Mistral, and enterprise AI labs', ARRAY['Kubernetes native', 'InfiniBand included', 'GB200 NVL72 availability', 'Enterprise SLA'], ARRAY['Higher prices', 'Requires K8s expertise', 'No simple VM API'], ARRAY['Enterprise AI training', 'Large model deployment', 'Frontier AI labs']),
    ('voltage-park', 'Voltage Park', 'Voltage Park', 'specialized_neocloud', 'enterprise', 'USA', 'https://voltagepark.com', 'https://voltagepark.com/pricing', 'https://docs.voltagepark.com/on-demand/api', 'https://cloud-api.voltagepark.com', 'bearer_token', true, 99.9, false, true, 'Bare metal H100 specialist with 24,000+ GPU cluster', ARRAY['Lowest H100 SXM prices', 'True bare metal', 'No virtualization overhead', 'Full hardware control'], ARRAY['Limited GPU variety', 'Bare metal complexity'], ARRAY['Distributed training', 'Price-sensitive enterprise', 'ML researchers']),
    ('nebius', 'Nebius AI', 'Nebius', 'regional_cloud', 'enterprise', 'NLD', 'https://nebius.com', 'https://nebius.com/pricing', 'https://docs.nebius.com', 'api.nebius.cloud:443', 'iam_token', true, 99.9, true, true, 'European GPU cloud from ex-Yandex team with aggressive H200 deployment', ARRAY['Lowest H200 preemptible rates', 'European data residency', 'Modern gRPC API', 'S3-compatible storage'], ARRAY['Limited US presence'], ARRAY['European enterprises', 'GDPR compliance', 'Cost-optimized training']),
    ('gmi-cloud', 'GMI Cloud', 'GMI', 'regional_cloud', 'standard', 'TWN', 'https://gmicloud.ai', 'https://gmicloud.ai/pricing', 'https://docs.gmicloud.ai', 'https://api.gmi-serving.com/v1', 'bearer_token', true, 99.5, false, true, 'Taiwan-based cloud with supply chain advantages from Quanta/Wistron partnerships', ARRAY['Lowest H200 prices globally', 'Fast hardware deployment', 'Asia-Pacific presence'], ARRAY['Newer platform', 'Limited track record'], ARRAY['Asia-Pacific workloads', 'Cost-sensitive inference']),
    ('hyperstack', 'Hyperstack', 'Hyperstack', 'regional_cloud', 'standard', 'GBR', 'https://hyperstack.cloud', 'https://hyperstack.cloud/pricing', 'https://docs.hyperstack.cloud', 'https://infrahub-api.nexgencloud.com/v1', 'api_key', true, 99.5, false, false, 'Green energy GPU cloud focusing on sustainability', ARRAY['Green energy powered', 'Competitive H100 pricing', 'European locations'], ARRAY['Smaller scale'], ARRAY['Sustainability-focused teams', 'European compliance']),
    ('scaleway', 'Scaleway', 'Scaleway', 'regional_cloud', 'standard', 'FRA', 'https://scaleway.com', 'https://scaleway.com/en/pricing', 'https://developers.scaleway.com', 'https://api.scaleway.com', 'x_auth_token', true, 99.9, false, false, 'French cloud provider with GPU instances', ARRAY['European sovereignty', 'Strong compliance', 'Integrated ecosystem'], ARRAY['Limited GPU inventory'], ARRAY['French enterprises', 'EU data residency']),
    ('runpod', 'RunPod', 'RunPod', 'marketplace', 'standard', 'USA', 'https://runpod.io', 'https://runpod.io/pricing', 'https://docs.runpod.io', 'https://api.runpod.io/graphql', 'api_key', true, 99.0, true, false, 'Developer-friendly GPU marketplace bridging community and secure cloud', ARRAY['Serverless AI endpoints', 'Community cloud savings', 'Docker-native', 'RTX 5090 availability'], ARRAY['Variable community reliability'], ARRAY['Indie developers', 'Startups', 'Serverless inference']),
    ('tensordock', 'TensorDock', 'TensorDock', 'marketplace', 'standard', 'USA', 'https://tensordock.com', 'https://tensordock.com/pricing', 'https://docs.tensordock.com', 'https://dashboard.tensordock.com/api/v0', 'api_key', true, 99.0, true, false, 'Affordable GPU marketplace with global server locations', ARRAY['Very competitive pricing', 'Wide GPU selection', 'Hourly billing'], ARRAY['Smaller provider'], ARRAY['Budget-conscious developers', 'Testing']),
    ('vast-ai', 'Vast.ai', 'Vast.ai', 'depin', 'community', 'USA', 'https://vast.ai', 'https://vast.ai', 'https://docs.vast.ai/api-reference', 'https://console.vast.ai/api/v0', 'api_key', true, NULL, true, false, 'Decentralized GPU rental marketplace with lowest prices globally', ARRAY['Absolute lowest prices', 'Huge GPU variety', 'Powerful filtering CLI'], ARRAY['No SLA', 'Variable quality', 'Host-dependent reliability'], ARRAY['Batch processing', 'Non-critical workloads', 'Experiments']),
    ('io-net', 'io.net', 'io.net', 'depin', 'community', 'USA', 'https://io.net', 'https://io.net/pricing', 'https://docs.io.net', NULL, 'api_key', true, NULL, false, false, 'Decentralized compute network aggregating crypto mining and datacenter capacity', ARRAY['Ray cluster support', 'Distributed training ready', 'Token incentives'], ARRAY['Crypto-native complexity', 'Variable availability'], ARRAY['Distributed ML', 'Ray workloads']),
    ('salad', 'Salad', 'Salad', 'depin', 'community', 'USA', 'https://salad.com', 'https://salad.com/pricing', 'https://docs.salad.com/reference/api-usage', 'https://api.salad.com/api/public', 'header_key', true, NULL, false, false, 'Consumer GPU network with millions of gaming PCs', ARRAY['Massive scale', 'Lowest consumer GPU prices', 'Great for batch jobs'], ARRAY['No SSH access', 'Short job limits', 'Container-only'], ARRAY['Image generation at scale', 'Transcoding', 'Batch inference']),
    ('latitude-sh', 'Latitude.sh', 'Latitude', 'bare_metal', 'standard', 'BRA', 'https://latitude.sh', 'https://latitude.sh/pricing', 'https://docs.latitude.sh', 'https://api.latitude.sh', 'bearer_token', true, 99.5, false, true, 'Global bare metal provider with GPU servers', ARRAY['True bare metal', 'Global locations', 'Strong API'], ARRAY['Limited GPU options'], ARRAY['Bare metal enthusiasts', 'Custom deployments']),
    ('vultr', 'Vultr', 'Vultr', 'bare_metal', 'standard', 'USA', 'https://vultr.com', 'https://vultr.com/pricing', 'https://vultr.com/api', 'https://api.vultr.com/v2', 'bearer_token', true, 99.99, false, false, 'Global cloud with GPU cloud compute instances', ARRAY['Global presence', 'Simple pricing', 'Good API'], ARRAY['Limited high-end GPUs'], ARRAY['General cloud workloads', 'Development']),
    ('aws', 'Amazon Web Services', 'AWS', 'hyperscaler', 'enterprise', 'USA', 'https://aws.amazon.com', 'https://aws.amazon.com/ec2/pricing', 'https://docs.aws.amazon.com', 'https://ec2.amazonaws.com', 'aws_sig_v4', true, 99.99, true, true, 'Market leader with broadest GPU selection', ARRAY['Massive scale', 'All GPU types', 'Spot instances', 'Global regions'], ARRAY['Complex pricing', 'Higher costs'], ARRAY['Enterprise', 'Regulated industries']),
    ('gcp', 'Google Cloud Platform', 'GCP', 'hyperscaler', 'enterprise', 'USA', 'https://cloud.google.com', 'https://cloud.google.com/compute/gpus-pricing', 'https://cloud.google.com/docs', 'https://compute.googleapis.com', 'oauth2', true, 99.99, true, true, 'Strong ML ecosystem with TPU alternative', ARRAY['TPU access', 'ML tooling', 'Preemptible VMs'], ARRAY['Complex pricing'], ARRAY['Enterprise ML', 'TPU workloads']),
    ('azure', 'Microsoft Azure', 'Azure', 'hyperscaler', 'enterprise', 'USA', 'https://azure.microsoft.com', 'https://azure.microsoft.com/pricing/details/virtual-machines/linux/', 'https://docs.microsoft.com/azure', 'https://management.azure.com', 'oauth2', true, 99.99, true, true, 'Enterprise cloud with strong OpenAI partnership', ARRAY['OpenAI integration', 'Enterprise features', 'Hybrid cloud'], ARRAY['Complex pricing'], ARRAY['Enterprise', 'OpenAI API users']),
    ('crusoe', 'Crusoe Energy', 'Crusoe', 'specialized_neocloud', 'enterprise', 'USA', 'https://crusoe.ai', 'https://crusoe.ai/cloud', 'https://docs.crusoe.ai', NULL, 'bearer_token', false, 99.9, false, true, 'Climate-friendly GPU cloud using stranded energy', ARRAY['Carbon-negative compute', 'H100 availability'], ARRAY['Limited public API'], ARRAY['Sustainability focus', 'Enterprise AI']),
    ('paperspace', 'Paperspace (by DigitalOcean)', 'Paperspace', 'marketplace', 'standard', 'USA', 'https://paperspace.com', 'https://paperspace.com/pricing', 'https://docs.paperspace.com', 'https://api.paperspace.io', 'api_key', true, 99.5, false, false, 'Developer-friendly GPU cloud now owned by DigitalOcean', ARRAY['Gradient notebooks', 'Simple interface', 'Good for ML learning'], ARRAY['Older GPU inventory'], ARRAY['ML education', 'Prototyping']),
    ('fluidstack', 'FluidStack', 'FluidStack', 'marketplace', 'standard', 'GBR', 'https://fluidstack.io', 'https://fluidstack.io/pricing', 'https://docs.fluidstack.io', 'https://api.fluidstack.io', 'api_key', true, 99.0, true, false, 'GPU cloud aggregator with competitive pricing', ARRAY['Price aggregation', 'Multiple datacenter partners'], ARRAY['Smaller scale'], ARRAY['Cost optimization', 'Flexible workloads']),
    ('oblivus', 'Oblivus Cloud', 'Oblivus', 'regional_cloud', 'standard', 'SWE', 'https://oblivus.com', 'https://oblivus.com/pricing', 'https://docs.oblivus.com', NULL, 'api_key', false, 99.5, false, false, 'Nordic GPU cloud with green energy focus', ARRAY['100% renewable energy', 'Nordic cooling efficiency'], ARRAY['Limited GPU types'], ARRAY['Green computing', 'Nordic enterprises']),
    ('datacrunch', 'DataCrunch', 'DataCrunch', 'regional_cloud', 'standard', 'FIN', 'https://datacrunch.io', 'https://datacrunch.io/pricing', 'https://docs.datacrunch.io', 'https://api.datacrunch.io', 'api_key', true, 99.5, false, false, 'Finnish GPU cloud for AI workloads', ARRAY['Nordic location', 'Competitive pricing'], ARRAY['Smaller provider'], ARRAY['EU workloads', 'Research'])
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    provider_type = EXCLUDED.provider_type,
    reliability_tier = EXCLUDED.reliability_tier,
    pricing_url = EXCLUDED.pricing_url,
    api_base_url = EXCLUDED.api_base_url,
    sla_uptime_percent = EXCLUDED.sla_uptime_percent,
    description = EXCLUDED.description,
    pros = EXCLUDED.pros,
    cons = EXCLUDED.cons,
    updated_at = NOW();

-- ============================================================================
-- SECTION 8: PERMISSIONS
-- ============================================================================
\echo '  [8/8] Configuring permissions...'

-- Supabase-managed roles are present in production, but may be missing in local Postgres.
-- Create them idempotently so this migration can run in both environments.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA cloudgpus TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cloudgpus TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA cloudgpus TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA cloudgpus TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA cloudgpus TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cloudgpus TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA cloudgpus
    GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cloudgpus
    GRANT ALL ON TABLES TO service_role;

COMMIT;

\echo ''
\echo '=== Migration completed successfully! ==='
\echo ''
\echo 'Tables created:'
\echo '  - cloudgpus.gpu_models (12 GPU models seeded)'
\echo '  - cloudgpus.providers (22 providers seeded)'
\echo '  - cloudgpus.instances'
\echo '  - cloudgpus.price_history'
\echo '  - cloudgpus.scrape_jobs'
\echo '  - cloudgpus.gpu_benchmarks'
\echo '  - cloudgpus.content_pages'
\echo ''
\echo 'Next steps:'
\echo '  1. Configure scraper to populate instances table'
\echo '  2. Set up scheduled cleanup: SELECT cloudgpus.cleanup_stale_instances();'
\echo '  3. Configure backup script'
\echo ''
