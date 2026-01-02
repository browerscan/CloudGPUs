# CloudGPUs.io Database Architecture

## Overview

PostgreSQL schema for a GPU cloud pricing aggregation platform supporting 40+ providers, real-time pricing, historical trends, and pSEO content generation.

**Connection String:**

```
postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/postgres?schema=cloudgpus
```

---

## Table of Contents

1. [Schema Design](#1-schema-design)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Performance Optimization](#3-performance-optimization)
4. [Triggers and Functions](#4-triggers-and-functions)
5. [Migration Strategy](#5-migration-strategy)
6. [Backup and Recovery](#6-backup-and-recovery)
7. [Operational Queries](#7-operational-queries)

---

## 1. Schema Design

### 1.1 Schema Initialization

```sql
-- ============================================================================
-- CloudGPUs.io Database Schema
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: GPU cloud pricing aggregation with 40+ providers
-- ============================================================================

-- Create schema (idempotent)
CREATE SCHEMA IF NOT EXISTS cloudgpus;

-- Set search path for this session
SET search_path TO cloudgpus, public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization
```

### 1.2 ENUM Types

```sql
-- ============================================================================
-- ENUM TYPES
-- Using ENUMs for fixed, rarely-changing categorical data
-- Rationale: Better type safety, smaller storage, faster comparisons vs lookup tables
-- ============================================================================

-- Provider reliability classification
-- enterprise: 99.9%+ SLA, enterprise support (CoreWeave, Lambda)
-- standard: 99%+ SLA, business support (RunPod Secure, GMI Cloud)
-- community: No SLA guarantee, variable uptime (Vast.ai, Salad)
DO $$ BEGIN
    CREATE TYPE cloudgpus.reliability_tier AS ENUM ('enterprise', 'standard', 'community');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Provider business model classification
DO $$ BEGIN
    CREATE TYPE cloudgpus.provider_type AS ENUM (
        'specialized_neocloud',  -- CoreWeave, Lambda Labs, Voltage Park
        'hyperscaler',           -- AWS, GCP, Azure
        'regional_cloud',        -- Nebius, GMI Cloud, Hyperstack, Scaleway
        'marketplace',           -- RunPod, TensorDock
        'depin',                 -- Vast.ai, io.net, Salad (decentralized)
        'bare_metal'             -- Latitude.sh, Vultr
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- GPU architecture generation
DO $$ BEGIN
    CREATE TYPE cloudgpus.gpu_architecture AS ENUM (
        'blackwell',   -- B200, GB200
        'hopper',      -- H100, H200
        'ada_lovelace', -- RTX 4090, L40S
        'ampere',      -- A100, RTX 3090
        'turing',      -- T4, RTX 2080
        'volta',       -- V100
        'consumer_blackwell'  -- RTX 5090
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Instance availability status
DO $$ BEGIN
    CREATE TYPE cloudgpus.availability_status AS ENUM (
        'available',      -- Currently available for provisioning
        'limited',        -- Low stock / limited regions
        'waitlist',       -- Requires signup / queue
        'sold_out',       -- Temporarily unavailable
        'contact_sales',  -- Requires enterprise sales contact
        'deprecated'      -- Being phased out
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Scrape job status
DO $$ BEGIN
    CREATE TYPE cloudgpus.scrape_status AS ENUM (
        'pending',
        'running',
        'completed',
        'failed',
        'timeout',
        'rate_limited'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Benchmark workload type
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
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
```

### 1.3 Core Tables

```sql
-- ============================================================================
-- TABLE: gpu_models
-- Normalized GPU hardware catalog
-- Write frequency: Low (admin only, ~100 rows)
-- Read frequency: Very High (joined on every instance query)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.gpu_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug VARCHAR(50) NOT NULL UNIQUE,           -- 'h100-sxm', 'rtx-5090', 'a100-80gb'
    name VARCHAR(100) NOT NULL,                 -- 'NVIDIA H100 SXM'
    short_name VARCHAR(30) NOT NULL,            -- 'H100' (for UI display)
    manufacturer VARCHAR(50) NOT NULL DEFAULT 'NVIDIA',

    -- Technical Specifications
    architecture cloudgpus.gpu_architecture NOT NULL,
    vram_gb SMALLINT NOT NULL,                  -- 80, 141, 32
    memory_type VARCHAR(20) NOT NULL,           -- 'HBM3e', 'GDDR7', 'HBM2e'
    memory_bandwidth_gbps INTEGER,              -- 3350 (GB/s)
    tdp_watts SMALLINT,                         -- 700W, 450W

    -- Compute Capabilities (FP precision TFLOPS)
    fp64_tflops NUMERIC(6,2),
    fp32_tflops NUMERIC(6,2),
    fp16_tflops NUMERIC(7,2),
    fp8_tflops NUMERIC(7,2),
    int8_tops NUMERIC(7,2),

    -- Form Factor
    form_factor VARCHAR(20),                    -- 'SXM5', 'PCIe', 'NVL'
    interconnect VARCHAR(30),                   -- 'NVLink', 'PCIe Gen5', 'NVLink + NVSwitch'

    -- Classification
    is_datacenter BOOLEAN NOT NULL DEFAULT true,
    is_consumer BOOLEAN NOT NULL DEFAULT false,
    generation_year SMALLINT,

    -- SEO & Content
    description TEXT,
    use_cases TEXT[],                           -- ['LLM Training', 'Inference', 'Fine-tuning']

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT gpu_vram_positive CHECK (vram_gb > 0),
    CONSTRAINT gpu_bandwidth_positive CHECK (memory_bandwidth_gbps IS NULL OR memory_bandwidth_gbps > 0),
    CONSTRAINT gpu_tdp_positive CHECK (tdp_watts IS NULL OR tdp_watts > 0)
);

-- Indexes for gpu_models
CREATE INDEX IF NOT EXISTS idx_gpu_models_architecture ON cloudgpus.gpu_models(architecture);
CREATE INDEX IF NOT EXISTS idx_gpu_models_vram ON cloudgpus.gpu_models(vram_gb);
CREATE INDEX IF NOT EXISTS idx_gpu_models_slug ON cloudgpus.gpu_models(slug);

COMMENT ON TABLE cloudgpus.gpu_models IS 'Normalized GPU hardware catalog with technical specifications';
COMMENT ON COLUMN cloudgpus.gpu_models.slug IS 'URL-safe identifier used in routes: /gpu/h100-sxm';
COMMENT ON COLUMN cloudgpus.gpu_models.memory_bandwidth_gbps IS 'Memory bandwidth in GB/s, critical for inference performance';


-- ============================================================================
-- TABLE: providers
-- Cloud provider registry with affiliate and API metadata
-- Write frequency: Low (admin only, ~50 rows)
-- Read frequency: Very High (joined on every instance query)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug VARCHAR(50) NOT NULL UNIQUE,           -- 'lambda-labs', 'coreweave', 'vast-ai'
    name VARCHAR(100) NOT NULL,                 -- 'Lambda Labs'
    display_name VARCHAR(100) NOT NULL,         -- 'Lambda' (shorter for UI)

    -- Classification
    provider_type cloudgpus.provider_type NOT NULL,
    reliability_tier cloudgpus.reliability_tier NOT NULL,

    -- Business Details
    headquarters_country VARCHAR(3),            -- ISO 3166-1 alpha-3: 'USA', 'DEU'
    founded_year SMALLINT,

    -- URLs
    website_url VARCHAR(255) NOT NULL,
    pricing_url VARCHAR(255),
    docs_url VARCHAR(255),
    status_page_url VARCHAR(255),

    -- API Integration
    api_base_url VARCHAR(255),
    api_auth_type VARCHAR(50),                  -- 'bearer_token', 'api_key', 'kubeconfig'
    has_public_api BOOLEAN NOT NULL DEFAULT false,
    api_rate_limit_rpm INTEGER,                 -- Requests per minute

    -- Affiliate Program
    affiliate_url VARCHAR(500),                 -- Full affiliate link
    affiliate_program_name VARCHAR(100),
    affiliate_commission_percent NUMERIC(4,2),
    affiliate_cookie_days SMALLINT,

    -- Service Characteristics
    sla_uptime_percent NUMERIC(5,2),            -- 99.90, 99.99
    supports_spot_instances BOOLEAN DEFAULT false,
    supports_reserved_instances BOOLEAN DEFAULT false,
    supports_bare_metal BOOLEAN DEFAULT false,
    min_billing_increment_seconds INTEGER,      -- 1, 60, 3600

    -- Regions (for filtering)
    available_regions TEXT[],                   -- ['us-east', 'eu-west', 'asia-pacific']

    -- Content
    description TEXT,
    pros TEXT[],
    cons TEXT[],
    best_for TEXT[],                            -- ['Enterprise training', 'Hobbyist projects']

    -- Logo/Branding
    logo_url VARCHAR(255),
    brand_color VARCHAR(7),                     -- '#FF6B35'

    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_price_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT provider_sla_range CHECK (sla_uptime_percent IS NULL OR (sla_uptime_percent >= 0 AND sla_uptime_percent <= 100)),
    CONSTRAINT provider_affiliate_commission_range CHECK (affiliate_commission_percent IS NULL OR (affiliate_commission_percent >= 0 AND affiliate_commission_percent <= 100))
);

-- Indexes for providers
CREATE INDEX IF NOT EXISTS idx_providers_type ON cloudgpus.providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_tier ON cloudgpus.providers(reliability_tier);
CREATE INDEX IF NOT EXISTS idx_providers_active ON cloudgpus.providers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_providers_slug ON cloudgpus.providers(slug);

COMMENT ON TABLE cloudgpus.providers IS 'Cloud provider registry with affiliate info and API metadata';
COMMENT ON COLUMN cloudgpus.providers.sla_uptime_percent IS 'Advertised SLA uptime percentage, used for DePIN filtering (>= 95%)';


-- ============================================================================
-- TABLE: instances
-- Real-time GPU instance pricing (main table, high write volume)
-- Write frequency: Very High (40+ providers x 10-60 min intervals = ~2400-14400 writes/day)
-- Read frequency: Very High (every page load)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,

    -- Instance Identity
    instance_type VARCHAR(100) NOT NULL,        -- 'gpu_8x_h100_sxm5', 'gpu.h100.8x'
    instance_name VARCHAR(150),                 -- Provider's display name

    -- GPU Configuration
    gpu_count SMALLINT NOT NULL DEFAULT 1,

    -- Pricing (all in USD)
    price_per_hour NUMERIC(10,4) NOT NULL,      -- Primary: per-GPU hourly rate
    price_per_hour_spot NUMERIC(10,4),          -- Spot/preemptible price
    price_per_month NUMERIC(12,2),              -- Reserved monthly (if different)
    price_per_hour_reserved_1y NUMERIC(10,4),   -- 1-year commitment rate
    price_per_hour_reserved_3y NUMERIC(10,4),   -- 3-year commitment rate

    -- Computed (maintained by trigger)
    price_per_gpu_hour NUMERIC(10,4) GENERATED ALWAYS AS (price_per_hour / NULLIF(gpu_count, 0)) STORED,
    price_per_vram_gb_hour NUMERIC(10,6),       -- Computed via trigger (needs GPU vram)

    -- Price Context (normalization)
    price_includes JSONB DEFAULT '{}'::jsonb,   -- {"infiniband": true, "storage_gb": 100, "egress_gb": 0}
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- System Resources
    vcpu_count SMALLINT,
    ram_gb SMALLINT,
    storage_type VARCHAR(30),                   -- 'NVMe SSD', 'Network', 'Local SSD'
    storage_gb INTEGER,
    network_bandwidth_gbps NUMERIC(6,2),

    -- Interconnect (critical for multi-GPU)
    has_nvlink BOOLEAN DEFAULT false,
    has_infiniband BOOLEAN DEFAULT false,
    infiniband_bandwidth_gbps INTEGER,

    -- Availability
    availability_status cloudgpus.availability_status NOT NULL DEFAULT 'available',
    available_regions TEXT[],
    min_rental_hours SMALLINT DEFAULT 1,
    max_rental_hours INTEGER,

    -- Billing
    billing_increment_seconds INTEGER DEFAULT 3600,  -- 1 = per-second, 3600 = hourly
    setup_fee NUMERIC(10,2) DEFAULT 0,

    -- Links
    instance_url VARCHAR(500),                  -- Direct link to this instance on provider

    -- Scraping Metadata
    raw_data JSONB,                             -- Original scraped data for debugging
    source_url VARCHAR(500),                    -- URL where data was scraped from
    last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scrape_job_id UUID,

    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT instances_price_positive CHECK (price_per_hour > 0),
    CONSTRAINT instances_gpu_count_positive CHECK (gpu_count > 0),
    CONSTRAINT instances_spot_price_valid CHECK (price_per_hour_spot IS NULL OR price_per_hour_spot > 0),

    -- Unique constraint for upsert operations
    CONSTRAINT instances_provider_type_unique UNIQUE (provider_id, instance_type)
);

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_instances_gpu_model ON cloudgpus.instances(gpu_model_id);
CREATE INDEX IF NOT EXISTS idx_instances_provider ON cloudgpus.instances(provider_id);
CREATE INDEX IF NOT EXISTS idx_instances_price ON cloudgpus.instances(price_per_gpu_hour);
CREATE INDEX IF NOT EXISTS idx_instances_active ON cloudgpus.instances(is_active) WHERE is_active = true;

-- Composite indexes for common queries
-- "Cheapest H100 by provider" query
CREATE INDEX IF NOT EXISTS idx_instances_gpu_price ON cloudgpus.instances(gpu_model_id, price_per_gpu_hour)
    WHERE is_active = true;

-- "All GPUs for Lambda Labs" query
CREATE INDEX IF NOT EXISTS idx_instances_provider_active ON cloudgpus.instances(provider_id, is_active, price_per_gpu_hour)
    WHERE is_active = true;

-- Freshness check index
CREATE INDEX IF NOT EXISTS idx_instances_last_scraped ON cloudgpus.instances(last_scraped_at);

-- Availability filtering
CREATE INDEX IF NOT EXISTS idx_instances_availability ON cloudgpus.instances(availability_status)
    WHERE availability_status = 'available';

COMMENT ON TABLE cloudgpus.instances IS 'Real-time GPU instance pricing - main table with high write volume';
COMMENT ON COLUMN cloudgpus.instances.price_per_gpu_hour IS 'Normalized price for comparison: total_price / gpu_count';
COMMENT ON COLUMN cloudgpus.instances.price_includes IS 'JSON describing what is included: {"infiniband": true, "storage_gb": 100}';


-- ============================================================================
-- TABLE: price_history
-- Time-series for 30-day trend charts
-- Write frequency: Very High (same as instances, copied on each update)
-- Read frequency: Medium (chart generation, trend analysis)
-- Storage: Consider partitioning by month for large scale
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    instance_id UUID NOT NULL REFERENCES cloudgpus.instances(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,

    -- Snapshot Data
    price_per_hour NUMERIC(10,4) NOT NULL,
    price_per_gpu_hour NUMERIC(10,4) NOT NULL,
    price_per_hour_spot NUMERIC(10,4),
    availability_status cloudgpus.availability_status NOT NULL,
    gpu_count SMALLINT NOT NULL,

    -- Timestamp (the key for time-series)
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Partition key (for monthly partitioning)
    recorded_month DATE GENERATED ALWAYS AS (DATE_TRUNC('month', recorded_at)::DATE) STORED
);

-- Time-series query indexes
-- "30-day price trend for H100" query
CREATE INDEX IF NOT EXISTS idx_price_history_gpu_time ON cloudgpus.price_history(gpu_model_id, recorded_at DESC);

-- Provider trend analysis
CREATE INDEX IF NOT EXISTS idx_price_history_provider_time ON cloudgpus.price_history(provider_id, recorded_at DESC);

-- Instance-specific history
CREATE INDEX IF NOT EXISTS idx_price_history_instance_time ON cloudgpus.price_history(instance_id, recorded_at DESC);

-- Cleanup index (for purging old data)
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON cloudgpus.price_history(recorded_at);

-- BRIN index for time-series (very efficient for sequential inserts)
CREATE INDEX IF NOT EXISTS idx_price_history_brin ON cloudgpus.price_history USING BRIN(recorded_at);

COMMENT ON TABLE cloudgpus.price_history IS 'Historical price snapshots for trend charts, partitioned by month';


-- ============================================================================
-- TABLE: scrape_jobs
-- Observability for ingestion pipeline
-- Write frequency: High (one per scrape cycle per provider)
-- Read frequency: Low (admin dashboard, debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,

    -- Job Status
    status cloudgpus.scrape_status NOT NULL DEFAULT 'pending',

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Results
    instances_found INTEGER DEFAULT 0,
    instances_updated INTEGER DEFAULT 0,
    instances_created INTEGER DEFAULT 0,
    instances_deactivated INTEGER DEFAULT 0,

    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count SMALLINT DEFAULT 0,

    -- Debug Info
    request_url VARCHAR(500),
    response_status_code SMALLINT,
    raw_response_size_bytes INTEGER,

    -- Metadata
    scraper_version VARCHAR(20),
    worker_id VARCHAR(50)
);

-- Indexes for scrape_jobs
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_provider ON cloudgpus.scrape_jobs(provider_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON cloudgpus.scrape_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_time ON cloudgpus.scrape_jobs(started_at DESC);

COMMENT ON TABLE cloudgpus.scrape_jobs IS 'Scraper job logs for monitoring and debugging the ingestion pipeline';


-- ============================================================================
-- TABLE: gpu_benchmarks
-- Performance data for "best for" pSEO pages
-- Write frequency: Very Low (manual or periodic updates)
-- Read frequency: Medium (comparison pages, recommendations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.gpu_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Key
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,

    -- Benchmark Identity
    workload_type cloudgpus.benchmark_workload NOT NULL,
    benchmark_name VARCHAR(100) NOT NULL,       -- 'MLPerf Training v4.0', 'LLaMA 70B Inference'
    benchmark_version VARCHAR(20),

    -- Results
    score NUMERIC(12,2),
    score_unit VARCHAR(50),                     -- 'tokens/sec', 'samples/sec', 'TFLOPS'
    latency_ms NUMERIC(10,2),
    throughput NUMERIC(12,2),
    throughput_unit VARCHAR(50),

    -- Test Configuration
    batch_size INTEGER,
    precision VARCHAR(10),                      -- 'FP16', 'FP8', 'INT8'
    model_name VARCHAR(100),                    -- 'LLaMA-2-70B', 'Stable Diffusion XL'
    framework VARCHAR(50),                      -- 'PyTorch 2.0', 'TensorRT'

    -- Context
    test_date DATE,
    source_url VARCHAR(500),
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique per GPU per benchmark
    CONSTRAINT gpu_benchmarks_unique UNIQUE (gpu_model_id, workload_type, benchmark_name, precision)
);

-- Indexes for gpu_benchmarks
CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_gpu ON cloudgpus.gpu_benchmarks(gpu_model_id);
CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_workload ON cloudgpus.gpu_benchmarks(workload_type);

COMMENT ON TABLE cloudgpus.gpu_benchmarks IS 'GPU performance benchmarks for workload-specific recommendations';


-- ============================================================================
-- TABLE: content_pages (for pSEO)
-- Generated content for SEO pages
-- Write frequency: Low (content generation jobs)
-- Read frequency: High (page rendering)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Page Identity
    slug VARCHAR(200) NOT NULL UNIQUE,          -- 'cheapest-h100-providers', 'lambda-labs-vs-coreweave'
    page_type VARCHAR(50) NOT NULL,             -- 'gpu_detail', 'provider_detail', 'comparison', 'guide'

    -- SEO
    title VARCHAR(200) NOT NULL,
    meta_description VARCHAR(320),
    canonical_url VARCHAR(500),

    -- Content
    content_html TEXT,
    content_markdown TEXT,
    structured_data JSONB,                      -- JSON-LD for SEO

    -- Relations
    related_gpu_ids UUID[],
    related_provider_ids UUID[],

    -- Generation Metadata
    generated_at TIMESTAMPTZ,
    generation_prompt TEXT,
    generation_model VARCHAR(50),

    -- Publishing
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for content_pages
CREATE INDEX IF NOT EXISTS idx_content_pages_type ON cloudgpus.content_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_content_pages_published ON cloudgpus.content_pages(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_content_pages_slug ON cloudgpus.content_pages(slug);

COMMENT ON TABLE cloudgpus.content_pages IS 'Generated pSEO content pages for GPUs, providers, and comparisons';
```

---

## 2. Entity Relationship Diagram

```
+------------------+       +------------------+       +-------------------+
|   gpu_models     |       |    providers     |       |    instances      |
+------------------+       +------------------+       +-------------------+
| id (PK)          |<---+  | id (PK)          |<---+  | id (PK)           |
| slug             |    |  | slug             |    |  | provider_id (FK)  |----+
| name             |    |  | name             |    |  | gpu_model_id (FK) |----+
| architecture     |    |  | provider_type    |    |  | instance_type     |
| vram_gb          |    |  | reliability_tier |    |  | gpu_count         |
| memory_type      |    |  | sla_uptime_%     |    |  | price_per_hour    |
| ...              |    |  | affiliate_url    |    |  | price_per_gpu_hr  |
+------------------+    |  | api_base_url     |    |  | availability      |
        ^               |  | ...              |    |  | last_scraped_at   |
        |               |  +------------------+    |  +-------------------+
        |               |          ^               |          |
        |               |          |               |          |
        |               |          +---------------+          |
        |               |                                     |
        |               +-------------------------------------+
        |
        |          +-------------------+
        +--------->|  price_history    |
        |          +-------------------+
        |          | id (PK)           |
        |          | instance_id (FK)  |
        |          | provider_id (FK)  |
        +--------->| gpu_model_id (FK) |
                   | price_per_hour    |
                   | recorded_at       |
                   +-------------------+

+------------------+       +-------------------+
|  scrape_jobs     |       |  gpu_benchmarks   |
+------------------+       +-------------------+
| id (PK)          |       | id (PK)           |
| provider_id (FK) |------>| gpu_model_id (FK) |----+
| status           |       | workload_type     |
| started_at       |       | benchmark_name    |
| instances_found  |       | score             |
| error_message    |       | ...               |
+------------------+       +-------------------+

+-------------------+
|  content_pages    |
+-------------------+
| id (PK)           |
| slug              |
| page_type         |
| title             |
| content_html      |
| related_gpu_ids[] |
| ...               |
+-------------------+
```

---

## 3. Performance Optimization

### 3.1 Index Strategy Summary

| Table         | Index                         | Purpose                   | Type             |
| ------------- | ----------------------------- | ------------------------- | ---------------- |
| instances     | idx_instances_gpu_price       | "Cheapest GPU" queries    | Composite B-tree |
| instances     | idx_instances_provider_active | "Provider's GPUs" queries | Composite B-tree |
| instances     | idx_instances_last_scraped    | Data freshness checks     | B-tree           |
| price_history | idx_price_history_gpu_time    | 30-day trend charts       | Composite B-tree |
| price_history | idx_price_history_brin        | Range scans on time       | BRIN             |
| scrape_jobs   | idx_scrape_jobs_status        | Active job monitoring     | Partial B-tree   |

### 3.1.1 Performance Indexes

The following indexes are created for query optimization:

| Index                         | Table         | Purpose                                        |
| ----------------------------- | ------------- | ---------------------------------------------- |
| `idx_instances_compare_query` | instances     | Optimizes DISTINCT ON provider with GPU filter |
| `idx_price_history_gpu_agg`   | price_history | Covering index for aggregation queries         |
| `idx_instances_regions_gin`   | instances     | GIN index for array containment                |
| `idx_providers_slug_covering` | providers     | Covering index for slug lookups                |
| `idx_instances_provider_gpu`  | instances     | Optimizes provider+GPU combo queries           |

### 3.2 Partitioning Strategy for price_history

For high-volume deployments (>1M rows/month), implement range partitioning:

```sql
-- ============================================================================
-- PARTITIONING: price_history by month
-- Only implement when table exceeds 10M rows
-- ============================================================================

-- Step 1: Create partitioned table structure
CREATE TABLE IF NOT EXISTS cloudgpus.price_history_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    provider_id UUID NOT NULL,
    gpu_model_id UUID NOT NULL,
    price_per_hour NUMERIC(10,4) NOT NULL,
    price_per_gpu_hour NUMERIC(10,4) NOT NULL,
    price_per_hour_spot NUMERIC(10,4),
    availability_status cloudgpus.availability_status NOT NULL,
    gpu_count SMALLINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Step 2: Create monthly partitions (example for 2025)
CREATE TABLE IF NOT EXISTS cloudgpus.price_history_2025_01
    PARTITION OF cloudgpus.price_history_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS cloudgpus.price_history_2025_02
    PARTITION OF cloudgpus.price_history_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... continue for each month

-- Step 3: Create default partition for future data
CREATE TABLE IF NOT EXISTS cloudgpus.price_history_default
    PARTITION OF cloudgpus.price_history_partitioned DEFAULT;
```

### 3.3 VACUUM and ANALYZE Configuration

```sql
-- ============================================================================
-- MAINTENANCE: Auto-vacuum tuning for high-write tables
-- ============================================================================

-- instances table: Frequent updates, needs aggressive vacuuming
ALTER TABLE cloudgpus.instances SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum when 5% of rows changed (default 20%)
    autovacuum_analyze_scale_factor = 0.02, -- Analyze when 2% of rows changed
    autovacuum_vacuum_cost_delay = 10       -- More aggressive (default 20ms)
);

-- price_history table: Insert-only, less aggressive vacuuming needed
ALTER TABLE cloudgpus.price_history SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    fillfactor = 90                          -- Leave room for HOT updates
);

-- Manual maintenance commands (run during low-traffic periods)
-- VACUUM ANALYZE cloudgpus.instances;
-- VACUUM ANALYZE cloudgpus.price_history;
-- REINDEX TABLE CONCURRENTLY cloudgpus.instances;
```

### 3.4 Connection Pooling Notes

```sql
-- ============================================================================
-- CONNECTION POOL SETTINGS (for Supabase/PgBouncer)
-- ============================================================================

-- Recommended pool settings for CloudGPUs workload:
-- - Pool mode: transaction
-- - Default pool size: 20
-- - Max client connections: 100
-- - Reserve pool size: 5

-- Optimize for short-lived queries:
-- SET statement_timeout = '30s';
-- SET idle_in_transaction_session_timeout = '60s';
```

---

## 4. Triggers and Functions

### 4.1 Updated Timestamp Trigger

```sql
-- ============================================================================
-- FUNCTION: update_timestamp()
-- Auto-update updated_at column on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION cloudgpus.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
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
```

### 4.2 Price Per VRAM Computation

```sql
-- ============================================================================
-- FUNCTION: compute_price_per_vram()
-- Calculate price per GB of VRAM per hour for value comparisons
-- ============================================================================
CREATE OR REPLACE FUNCTION cloudgpus.compute_price_per_vram()
RETURNS TRIGGER AS $$
DECLARE
    v_vram_gb SMALLINT;
BEGIN
    -- Get VRAM from gpu_models
    SELECT vram_gb INTO v_vram_gb
    FROM cloudgpus.gpu_models
    WHERE id = NEW.gpu_model_id;

    -- Calculate price per VRAM GB per hour
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
```

### 4.3 Price History Recording

```sql
-- ============================================================================
-- FUNCTION: record_price_history()
-- Automatically record price changes to history table
-- Only records if price actually changed (avoids duplicates)
-- ============================================================================
CREATE OR REPLACE FUNCTION cloudgpus.record_price_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record if price or availability changed
    IF TG_OP = 'INSERT' OR
       OLD.price_per_hour IS DISTINCT FROM NEW.price_per_hour OR
       OLD.price_per_hour_spot IS DISTINCT FROM NEW.price_per_hour_spot OR
       OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN

        INSERT INTO cloudgpus.price_history (
            instance_id,
            provider_id,
            gpu_model_id,
            price_per_hour,
            price_per_gpu_hour,
            price_per_hour_spot,
            availability_status,
            gpu_count,
            recorded_at
        ) VALUES (
            NEW.id,
            NEW.provider_id,
            NEW.gpu_model_id,
            NEW.price_per_hour,
            NEW.price_per_gpu_hour,
            NEW.price_per_hour_spot,
            NEW.availability_status,
            NEW.gpu_count,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS record_instance_price_history ON cloudgpus.instances;
CREATE TRIGGER record_instance_price_history
    AFTER INSERT OR UPDATE ON cloudgpus.instances
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.record_price_history();
```

### 4.4 Provider Last Update Tracker

```sql
-- ============================================================================
-- FUNCTION: update_provider_last_price_update()
-- Track when each provider was last updated
-- ============================================================================
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
```

### 4.5 Data Validation Functions

```sql
-- ============================================================================
-- FUNCTION: validate_depin_provider()
-- Validate DePIN providers meet minimum uptime requirements
-- ============================================================================
CREATE OR REPLACE FUNCTION cloudgpus.validate_depin_uptime()
RETURNS TRIGGER AS $$
BEGIN
    -- DePIN providers displayed on main comparison must have >= 95% uptime
    -- This is for filtering, not a hard constraint
    IF NEW.provider_type = 'depin' AND
       NEW.sla_uptime_percent IS NOT NULL AND
       NEW.sla_uptime_percent < 95 THEN
        -- Log warning but allow insert
        RAISE NOTICE 'DePIN provider % has uptime below 95%% threshold', NEW.name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_depin_provider_uptime ON cloudgpus.providers;
CREATE TRIGGER validate_depin_provider_uptime
    BEFORE INSERT OR UPDATE ON cloudgpus.providers
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.validate_depin_uptime();

-- ============================================================================
-- FUNCTION: cleanup_stale_instances()
-- Mark instances as inactive if not updated in 24 hours
-- ============================================================================
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

-- Schedule this function via pg_cron or external scheduler:
-- SELECT cron.schedule('cleanup_stale', '0 * * * *', 'SELECT cloudgpus.cleanup_stale_instances()');
```

---

## 5. Migration Strategy

### 5.1 Seed Data: GPU Models

```sql
-- ============================================================================
-- SEED DATA: GPU Models
-- Core GPU catalog for 2025
-- ============================================================================

INSERT INTO cloudgpus.gpu_models (slug, name, short_name, manufacturer, architecture, vram_gb, memory_type, memory_bandwidth_gbps, tdp_watts, fp16_tflops, fp8_tflops, form_factor, interconnect, is_datacenter, is_consumer, generation_year, description, use_cases)
VALUES
    -- Blackwell Generation
    ('b200-sxm', 'NVIDIA B200 SXM', 'B200', 'NVIDIA', 'blackwell', 192, 'HBM3e', 8000, 1000, 4500, 9000, 'SXM', 'NVLink + NVSwitch', true, false, 2024, 'Flagship Blackwell GPU for trillion-parameter model training', ARRAY['LLM Training', 'Scientific Computing', 'Large-Scale AI']),
    ('gb200-nvl', 'NVIDIA GB200 NVL72', 'GB200', 'NVIDIA', 'blackwell', 192, 'HBM3e', 8000, 2700, 5000, 10000, 'NVL', 'NVLink + NVSwitch', true, false, 2024, 'Grace Blackwell Superchip with 72-GPU rack configuration', ARRAY['Frontier AI Training', 'HPC', 'Enterprise AI']),

    -- Hopper Generation
    ('h200-sxm', 'NVIDIA H200 SXM', 'H200', 'NVIDIA', 'hopper', 141, 'HBM3e', 4800, 700, 1979, 3958, 'SXM5', 'NVLink', true, false, 2024, 'Enhanced Hopper with 141GB HBM3e for large model inference', ARRAY['LLM Inference', 'Fine-tuning', 'RAG']),
    ('h100-sxm', 'NVIDIA H100 SXM', 'H100 SXM', 'NVIDIA', 'hopper', 80, 'HBM3', 3350, 700, 1979, 3958, 'SXM5', 'NVLink', true, false, 2023, 'Industry standard for AI training and inference', ARRAY['LLM Training', 'LLM Inference', 'Fine-tuning', 'Image Generation']),
    ('h100-pcie', 'NVIDIA H100 PCIe', 'H100 PCIe', 'NVIDIA', 'hopper', 80, 'HBM3', 2000, 350, 1513, 3026, 'PCIe', 'PCIe Gen5', true, false, 2023, 'PCIe variant for standard server deployments', ARRAY['Inference', 'Fine-tuning', 'Development']),

    -- Ada Lovelace Generation
    ('l40s', 'NVIDIA L40S', 'L40S', 'NVIDIA', 'ada_lovelace', 48, 'GDDR6', 864, 350, 362, 724, 'PCIe', 'PCIe Gen4', true, false, 2023, 'Versatile datacenter GPU for AI and graphics', ARRAY['Inference', 'Image Generation', 'Video Processing']),
    ('rtx-4090', 'NVIDIA GeForce RTX 4090', 'RTX 4090', 'NVIDIA', 'ada_lovelace', 24, 'GDDR6X', 1008, 450, 330, 660, 'PCIe', 'PCIe Gen4', false, true, 2022, 'Flagship consumer GPU with excellent price-performance', ARRAY['Inference', 'Fine-tuning', 'Image Generation', 'Development']),

    -- Blackwell Consumer
    ('rtx-5090', 'NVIDIA GeForce RTX 5090', 'RTX 5090', 'NVIDIA', 'consumer_blackwell', 32, 'GDDR7', 1792, 575, 419, 838, 'PCIe', 'PCIe Gen5', false, true, 2025, 'Next-gen consumer GPU with 32GB GDDR7, competitive with datacenter cards for inference', ARRAY['Inference', 'Fine-tuning', 'Image Generation', 'Video Generation']),

    -- Ampere Generation
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
```

### 5.2 Seed Data: Providers

```sql
-- ============================================================================
-- SEED DATA: Providers
-- 40+ GPU cloud providers as of December 2025
-- ============================================================================

INSERT INTO cloudgpus.providers (slug, name, display_name, provider_type, reliability_tier, headquarters_country, website_url, pricing_url, docs_url, api_base_url, api_auth_type, has_public_api, sla_uptime_percent, supports_spot_instances, supports_reserved_instances, description, pros, cons, best_for)
VALUES
    -- Specialized Neoclouds (Enterprise Tier)
    ('lambda-labs', 'Lambda Labs', 'Lambda', 'specialized_neocloud', 'enterprise', 'USA', 'https://lambdalabs.com', 'https://lambdalabs.com/service/gpu-cloud#pricing', 'https://docs.lambda.ai/api', 'https://api.lambda.ai/v1', 'bearer_token', true, 99.9, false, true, 'Pioneer in AI cloud computing, known for simplicity and developer focus', ARRAY['Simple REST API', 'Quick provisioning', 'Strong documentation', 'Competitive B200 pricing'], ARRAY['Limited regions', 'No spot instances'], ARRAY['AI startups', 'Research teams', 'Production inference']),

    ('coreweave', 'CoreWeave', 'CoreWeave', 'specialized_neocloud', 'enterprise', 'USA', 'https://coreweave.com', 'https://coreweave.com/pricing', 'https://docs.coreweave.com', 'https://api.coreweave.com', 'kubeconfig', true, 99.99, false, true, 'Kubernetes-native GPU cloud serving OpenAI, Mistral, and enterprise AI labs', ARRAY['Kubernetes native', 'InfiniBand included', 'GB200 NVL72 availability', 'Enterprise SLA'], ARRAY['Higher prices', 'Requires K8s expertise', 'No simple VM API'], ARRAY['Enterprise AI training', 'Large model deployment', 'Frontier AI labs']),

    ('voltage-park', 'Voltage Park', 'Voltage Park', 'specialized_neocloud', 'enterprise', 'USA', 'https://voltagepark.com', 'https://voltagepark.com/pricing', 'https://docs.voltagepark.com/on-demand/api', 'https://cloud-api.voltagepark.com', 'bearer_token', true, 99.9, false, true, 'Bare metal H100 specialist with 24,000+ GPU cluster', ARRAY['Lowest H100 SXM prices', 'True bare metal', 'No virtualization overhead', 'Full hardware control'], ARRAY['Limited GPU variety', 'Bare metal complexity'], ARRAY['Distributed training', 'Price-sensitive enterprise', 'ML researchers']),

    -- Regional Clouds
    ('nebius', 'Nebius AI', 'Nebius', 'regional_cloud', 'enterprise', 'NLD', 'https://nebius.com', 'https://nebius.com/pricing', 'https://docs.nebius.com', 'api.nebius.cloud:443', 'iam_token', true, 99.9, true, true, 'European GPU cloud from ex-Yandex team with aggressive H200 deployment', ARRAY['Lowest H200 preemptible rates', 'European data residency', 'Modern gRPC API', 'S3-compatible storage'], ARRAY['Limited US presence'], ARRAY['European enterprises', 'GDPR compliance', 'Cost-optimized training']),

    ('gmi-cloud', 'GMI Cloud', 'GMI', 'regional_cloud', 'standard', 'TWN', 'https://gmicloud.ai', 'https://gmicloud.ai/pricing', 'https://docs.gmicloud.ai', 'https://api.gmi-serving.com/v1', 'bearer_token', true, 99.5, false, true, 'Taiwan-based cloud with supply chain advantages from Quanta/Wistron partnerships', ARRAY['Lowest H200 prices globally', 'Fast hardware deployment', 'Asia-Pacific presence'], ARRAY['Newer platform', 'Limited track record'], ARRAY['Asia-Pacific workloads', 'Cost-sensitive inference']),

    ('hyperstack', 'Hyperstack', 'Hyperstack', 'regional_cloud', 'standard', 'GBR', 'https://hyperstack.cloud', 'https://hyperstack.cloud/pricing', 'https://docs.hyperstack.cloud', 'https://infrahub-api.nexgencloud.com/v1', 'api_key', true, 99.5, false, false, 'Green energy GPU cloud focusing on sustainability', ARRAY['Green energy powered', 'Competitive H100 pricing', 'European locations'], ARRAY['Smaller scale'], ARRAY['Sustainability-focused teams', 'European compliance']),

    ('scaleway', 'Scaleway', 'Scaleway', 'regional_cloud', 'standard', 'FRA', 'https://scaleway.com', 'https://scaleway.com/en/pricing', 'https://developers.scaleway.com', 'https://api.scaleway.com', 'x_auth_token', true, 99.9, false, false, 'French cloud provider with GPU instances', ARRAY['European sovereignty', 'Strong compliance', 'Integrated ecosystem'], ARRAY['Limited GPU inventory'], ARRAY['French enterprises', 'EU data residency']),

    -- Marketplaces (Standard Tier)
    ('runpod', 'RunPod', 'RunPod', 'marketplace', 'standard', 'USA', 'https://runpod.io', 'https://runpod.io/pricing', 'https://docs.runpod.io', 'https://api.runpod.io/graphql', 'api_key', true, 99.0, true, false, 'Developer-friendly GPU marketplace bridging community and secure cloud', ARRAY['Serverless AI endpoints', 'Community cloud savings', 'Docker-native', 'RTX 5090 availability'], ARRAY['Variable community reliability'], ARRAY['Indie developers', 'Startups', 'Serverless inference']),

    ('tensordock', 'TensorDock', 'TensorDock', 'marketplace', 'standard', 'USA', 'https://tensordock.com', 'https://tensordock.com/pricing', 'https://docs.tensordock.com', 'https://dashboard.tensordock.com/api/v0', 'api_key', true, 99.0, true, false, 'Affordable GPU marketplace with global server locations', ARRAY['Very competitive pricing', 'Wide GPU selection', 'Hourly billing'], ARRAY['Smaller provider'], ARRAY['Budget-conscious developers', 'Testing']),

    -- DePIN (Community Tier)
    ('vast-ai', 'Vast.ai', 'Vast.ai', 'depin', 'community', 'USA', 'https://vast.ai', 'https://vast.ai', 'https://docs.vast.ai/api-reference', 'https://console.vast.ai/api/v0', 'api_key', true, NULL, true, false, 'Decentralized GPU rental marketplace with lowest prices globally', ARRAY['Absolute lowest prices', 'Huge GPU variety', 'Powerful filtering CLI'], ARRAY['No SLA', 'Variable quality', 'Host-dependent reliability'], ARRAY['Batch processing', 'Non-critical workloads', 'Experiments']),

    ('io-net', 'io.net', 'io.net', 'depin', 'community', 'USA', 'https://io.net', 'https://io.net/pricing', 'https://docs.io.net', NULL, 'api_key', true, NULL, false, false, 'Decentralized compute network aggregating crypto mining and datacenter capacity', ARRAY['Ray cluster support', 'Distributed training ready', 'Token incentives'], ARRAY['Crypto-native complexity', 'Variable availability'], ARRAY['Distributed ML', 'Ray workloads']),

    ('salad', 'Salad', 'Salad', 'depin', 'community', 'USA', 'https://salad.com', 'https://salad.com/pricing', 'https://docs.salad.com/reference/api-usage', 'https://api.salad.com/api/public', 'header_key', true, NULL, false, false, 'Consumer GPU network with millions of gaming PCs', ARRAY['Massive scale', 'Lowest consumer GPU prices', 'Great for batch jobs'], ARRAY['No SSH access', 'Short job limits', 'Container-only'], ARRAY['Image generation at scale', 'Transcoding', 'Batch inference']),

    -- Bare Metal
    ('latitude-sh', 'Latitude.sh', 'Latitude', 'bare_metal', 'standard', 'BRA', 'https://latitude.sh', 'https://latitude.sh/pricing', 'https://docs.latitude.sh', 'https://api.latitude.sh', 'bearer_token', true, 99.5, false, true, 'Global bare metal provider with GPU servers', ARRAY['True bare metal', 'Global locations', 'Strong API'], ARRAY['Limited GPU options'], ARRAY['Bare metal enthusiasts', 'Custom deployments']),

    ('vultr', 'Vultr', 'Vultr', 'bare_metal', 'standard', 'USA', 'https://vultr.com', 'https://vultr.com/pricing', 'https://vultr.com/api', 'https://api.vultr.com/v2', 'bearer_token', true, 99.99, false, false, 'Global cloud with GPU cloud compute instances', ARRAY['Global presence', 'Simple pricing', 'Good API'], ARRAY['Limited high-end GPUs'], ARRAY['General cloud workloads', 'Development']),

    -- Hyperscalers (Reference only - typically not aggregated)
    ('aws', 'Amazon Web Services', 'AWS', 'hyperscaler', 'enterprise', 'USA', 'https://aws.amazon.com', 'https://aws.amazon.com/ec2/pricing', 'https://docs.aws.amazon.com', 'https://ec2.amazonaws.com', 'aws_sig_v4', true, 99.99, true, true, 'Market leader with broadest GPU selection', ARRAY['Massive scale', 'All GPU types', 'Spot instances', 'Global regions'], ARRAY['Complex pricing', 'Higher costs'], ARRAY['Enterprise', 'Regulated industries']),

    ('gcp', 'Google Cloud Platform', 'GCP', 'hyperscaler', 'enterprise', 'USA', 'https://cloud.google.com', 'https://cloud.google.com/compute/gpus-pricing', 'https://cloud.google.com/docs', 'https://compute.googleapis.com', 'oauth2', true, 99.99, true, true, 'Strong ML ecosystem with TPU alternative', ARRAY['TPU access', 'ML tooling', 'Preemptible VMs'], ARRAY['Complex pricing'], ARRAY['Enterprise ML', 'TPU workloads']),

    ('azure', 'Microsoft Azure', 'Azure', 'hyperscaler', 'enterprise', 'USA', 'https://azure.microsoft.com', 'https://azure.microsoft.com/pricing/details/virtual-machines/linux/', 'https://docs.microsoft.com/azure', 'https://management.azure.com', 'oauth2', true, 99.99, true, true, 'Enterprise cloud with strong OpenAI partnership', ARRAY['OpenAI integration', 'Enterprise features', 'Hybrid cloud'], ARRAY['Complex pricing'], ARRAY['Enterprise', 'OpenAI API users']),

    -- Additional providers for comprehensive coverage
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
```

### 5.3 Seed Data: Sample Benchmarks

```sql
-- ============================================================================
-- SEED DATA: GPU Benchmarks
-- Performance data for workload recommendations
-- ============================================================================

-- Get GPU model IDs
WITH gpu_ids AS (
    SELECT id, slug FROM cloudgpus.gpu_models
)
INSERT INTO cloudgpus.gpu_benchmarks (gpu_model_id, workload_type, benchmark_name, score, score_unit, batch_size, precision, model_name, framework, source_url)
SELECT
    g.id,
    b.workload_type,
    b.benchmark_name,
    b.score,
    b.score_unit,
    b.batch_size,
    b.precision,
    b.model_name,
    b.framework,
    b.source_url
FROM gpu_ids g
CROSS JOIN (
    VALUES
        -- H100 SXM Benchmarks
        ('h100-sxm', 'llm_inference'::cloudgpus.benchmark_workload, 'LLaMA-2-70B Inference', 85.0, 'tokens/sec', 1, 'FP16', 'LLaMA-2-70B', 'vLLM', 'https://docs.vllm.ai/en/latest/performance/benchmarks.html'),
        ('h100-sxm', 'llm_training'::cloudgpus.benchmark_workload, 'GPT-3 175B Training', 450.0, 'samples/sec', 2048, 'BF16', 'GPT-3 175B', 'Megatron-LM', NULL),
        ('h100-sxm', 'image_generation'::cloudgpus.benchmark_workload, 'SDXL Generation', 12.5, 'images/sec', 4, 'FP16', 'SDXL 1.0', 'Diffusers', NULL),

        -- H200 Benchmarks
        ('h200-sxm', 'llm_inference'::cloudgpus.benchmark_workload, 'LLaMA-2-70B Inference', 110.0, 'tokens/sec', 1, 'FP16', 'LLaMA-2-70B', 'vLLM', NULL),
        ('h200-sxm', 'llm_inference'::cloudgpus.benchmark_workload, 'LLaMA-3-405B Inference', 25.0, 'tokens/sec', 1, 'FP8', 'LLaMA-3-405B', 'vLLM', NULL),

        -- RTX 5090 Benchmarks
        ('rtx-5090', 'llm_inference'::cloudgpus.benchmark_workload, 'LLaMA-2-70B Inference (4-bit)', 45.0, 'tokens/sec', 1, 'INT4', 'LLaMA-2-70B-GPTQ', 'ExLlamaV2', NULL),
        ('rtx-5090', 'image_generation'::cloudgpus.benchmark_workload, 'SDXL Generation', 8.0, 'images/sec', 1, 'FP16', 'SDXL 1.0', 'ComfyUI', NULL),
        ('rtx-5090', 'fine_tuning'::cloudgpus.benchmark_workload, 'LLaMA-2-7B QLoRA', 2.5, 'samples/sec', 4, 'FP16', 'LLaMA-2-7B', 'PEFT', NULL),

        -- A100 80GB Benchmarks
        ('a100-80gb', 'llm_inference'::cloudgpus.benchmark_workload, 'LLaMA-2-70B Inference', 55.0, 'tokens/sec', 1, 'FP16', 'LLaMA-2-70B', 'vLLM', NULL),
        ('a100-80gb', 'llm_training'::cloudgpus.benchmark_workload, 'GPT-3 175B Training', 280.0, 'samples/sec', 1024, 'BF16', 'GPT-3 175B', 'Megatron-LM', NULL)
) AS b(gpu_slug, workload_type, benchmark_name, score, score_unit, batch_size, precision, model_name, framework, source_url)
WHERE g.slug = b.gpu_slug
ON CONFLICT (gpu_model_id, workload_type, benchmark_name, precision) DO UPDATE SET
    score = EXCLUDED.score,
    updated_at = NOW();
```

### 5.4 Rollback Procedures

```sql
-- ============================================================================
-- ROLLBACK SCRIPT
-- Use with extreme caution - drops all CloudGPUs schema objects
-- ============================================================================

-- Step 1: Drop triggers first
DROP TRIGGER IF EXISTS update_gpu_models_timestamp ON cloudgpus.gpu_models;
DROP TRIGGER IF EXISTS update_providers_timestamp ON cloudgpus.providers;
DROP TRIGGER IF EXISTS update_instances_timestamp ON cloudgpus.instances;
DROP TRIGGER IF EXISTS update_gpu_benchmarks_timestamp ON cloudgpus.gpu_benchmarks;
DROP TRIGGER IF EXISTS update_content_pages_timestamp ON cloudgpus.content_pages;
DROP TRIGGER IF EXISTS compute_instance_price_per_vram ON cloudgpus.instances;
DROP TRIGGER IF EXISTS record_instance_price_history ON cloudgpus.instances;
DROP TRIGGER IF EXISTS track_provider_price_update ON cloudgpus.instances;
DROP TRIGGER IF EXISTS validate_depin_provider_uptime ON cloudgpus.providers;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS cloudgpus.update_timestamp();
DROP FUNCTION IF EXISTS cloudgpus.compute_price_per_vram();
DROP FUNCTION IF EXISTS cloudgpus.record_price_history();
DROP FUNCTION IF EXISTS cloudgpus.update_provider_last_price_update();
DROP FUNCTION IF EXISTS cloudgpus.validate_depin_uptime();
DROP FUNCTION IF EXISTS cloudgpus.cleanup_stale_instances();

-- Step 3: Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS cloudgpus.content_pages;
DROP TABLE IF EXISTS cloudgpus.gpu_benchmarks;
DROP TABLE IF EXISTS cloudgpus.scrape_jobs;
DROP TABLE IF EXISTS cloudgpus.price_history;
DROP TABLE IF EXISTS cloudgpus.instances;
DROP TABLE IF EXISTS cloudgpus.providers;
DROP TABLE IF EXISTS cloudgpus.gpu_models;

-- Step 4: Drop types
DROP TYPE IF EXISTS cloudgpus.benchmark_workload;
DROP TYPE IF EXISTS cloudgpus.scrape_status;
DROP TYPE IF EXISTS cloudgpus.availability_status;
DROP TYPE IF EXISTS cloudgpus.gpu_architecture;
DROP TYPE IF EXISTS cloudgpus.provider_type;
DROP TYPE IF EXISTS cloudgpus.reliability_tier;

-- Step 5: Drop schema
DROP SCHEMA IF EXISTS cloudgpus;
```

---

## 6. Backup and Recovery

### 6.1 Backup Commands

```bash
# ============================================================================
# BACKUP COMMANDS
# Run from a host with PostgreSQL client and access to supabase-db
# ============================================================================

# Full schema backup (structure + data)
pg_dump -h supabase-db -U postgres -n cloudgpus \
    --format=custom \
    --file=/backup/cloudgpus_$(date +%Y%m%d_%H%M%S).dump

# Schema-only backup (structure without data)
pg_dump -h supabase-db -U postgres -n cloudgpus \
    --schema-only \
    --file=/backup/cloudgpus_schema_$(date +%Y%m%d).sql

# Data-only backup (for migration)
pg_dump -h supabase-db -U postgres -n cloudgpus \
    --data-only \
    --file=/backup/cloudgpus_data_$(date +%Y%m%d).sql

# Specific table backup (e.g., instances with high write volume)
pg_dump -h supabase-db -U postgres -n cloudgpus \
    --table=cloudgpus.instances \
    --table=cloudgpus.price_history \
    --format=custom \
    --file=/backup/cloudgpus_instances_$(date +%Y%m%d_%H%M%S).dump

# Compressed backup for offsite storage
pg_dump -h supabase-db -U postgres -n cloudgpus \
    --format=custom \
    --compress=9 \
    --file=/backup/cloudgpus_full_compressed_$(date +%Y%m%d).dump.gz
```

### 6.2 Restore Commands

```bash
# ============================================================================
# RESTORE COMMANDS
# ============================================================================

# Full restore from custom format
pg_restore -h supabase-db -U postgres \
    --dbname=postgres \
    --clean \
    --if-exists \
    /backup/cloudgpus_YYYYMMDD_HHMMSS.dump

# Restore specific table only
pg_restore -h supabase-db -U postgres \
    --dbname=postgres \
    --table=instances \
    --data-only \
    /backup/cloudgpus_instances_YYYYMMDD.dump

# Restore from SQL file
psql -h supabase-db -U postgres -d postgres < /backup/cloudgpus_schema_YYYYMMDD.sql
```

### 6.3 Automated Backup Script

```bash
#!/bin/bash
# ============================================================================
# /opt/docker-projects/cloudgpus/scripts/backup.sh
# Automated backup script for CloudGPUs database
# Schedule with cron: 0 2 * * * /opt/docker-projects/cloudgpus/scripts/backup.sh
# ============================================================================

set -euo pipefail

BACKUP_DIR="/backup/cloudgpus"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_HOST="supabase-db"
DB_USER="postgres"
SCHEMA="cloudgpus"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Perform backup
echo "[$(date)] Starting CloudGPUs backup..."
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -n "${SCHEMA}" \
    --format=custom \
    --compress=6 \
    --file="${BACKUP_DIR}/cloudgpus_${TIMESTAMP}.dump"

# Verify backup
if pg_restore --list "${BACKUP_DIR}/cloudgpus_${TIMESTAMP}.dump" > /dev/null 2>&1; then
    echo "[$(date)] Backup verified successfully: cloudgpus_${TIMESTAMP}.dump"
else
    echo "[$(date)] ERROR: Backup verification failed!"
    exit 1
fi

# Cleanup old backups
find "${BACKUP_DIR}" -name "cloudgpus_*.dump" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

# Report backup size
ls -lh "${BACKUP_DIR}/cloudgpus_${TIMESTAMP}.dump"
echo "[$(date)] Backup completed successfully"
```

### 6.4 Point-in-Time Recovery Notes

```sql
-- ============================================================================
-- POINT-IN-TIME RECOVERY (PITR)
-- Supabase provides PITR through their dashboard for Pro plans
-- For self-managed, enable WAL archiving in postgresql.conf:
-- ============================================================================

-- Check current WAL settings
SHOW archive_mode;
SHOW archive_command;
SHOW wal_level;

-- For PITR, ensure these are set in postgresql.conf:
-- wal_level = replica
-- archive_mode = on
-- archive_command = 'cp %p /backup/wal/%f'

-- Recovery example (in recovery.conf or postgresql.auto.conf):
-- restore_command = 'cp /backup/wal/%f %p'
-- recovery_target_time = '2025-12-30 14:30:00'
-- recovery_target_action = 'promote'
```

---

## 7. Operational Queries

### 7.1 Common Application Queries

```sql
-- ============================================================================
-- QUERY: Cheapest GPU instances by GPU model (GPU detail page)
-- ============================================================================
SELECT
    i.id,
    p.display_name AS provider,
    p.slug AS provider_slug,
    g.short_name AS gpu,
    i.gpu_count,
    i.price_per_gpu_hour,
    i.price_per_hour AS total_price,
    i.availability_status,
    p.reliability_tier,
    p.affiliate_url
FROM cloudgpus.instances i
JOIN cloudgpus.providers p ON i.provider_id = p.id
JOIN cloudgpus.gpu_models g ON i.gpu_model_id = g.id
WHERE g.slug = 'h100-sxm'  -- parameterized
  AND i.is_active = true
  AND i.availability_status IN ('available', 'limited')
ORDER BY i.price_per_gpu_hour ASC
LIMIT 20;

-- ============================================================================
-- QUERY: All GPUs for a provider (Provider detail page)
-- ============================================================================
SELECT
    g.short_name AS gpu,
    g.slug AS gpu_slug,
    g.vram_gb,
    g.architecture,
    i.gpu_count,
    i.price_per_gpu_hour,
    i.price_per_hour AS total_price,
    i.availability_status,
    i.has_nvlink,
    i.has_infiniband
FROM cloudgpus.instances i
JOIN cloudgpus.gpu_models g ON i.gpu_model_id = g.id
WHERE i.provider_id = (SELECT id FROM cloudgpus.providers WHERE slug = 'lambda-labs')
  AND i.is_active = true
ORDER BY g.vram_gb DESC, i.price_per_gpu_hour ASC;

-- ============================================================================
-- QUERY: 30-day price trend for a GPU model (Chart data)
-- ============================================================================
SELECT
    DATE_TRUNC('day', ph.recorded_at) AS date,
    p.display_name AS provider,
    AVG(ph.price_per_gpu_hour) AS avg_price,
    MIN(ph.price_per_gpu_hour) AS min_price,
    MAX(ph.price_per_gpu_hour) AS max_price
FROM cloudgpus.price_history ph
JOIN cloudgpus.providers p ON ph.provider_id = p.id
JOIN cloudgpus.gpu_models g ON ph.gpu_model_id = g.id
WHERE g.slug = 'h100-sxm'
  AND ph.recorded_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', ph.recorded_at), p.display_name
ORDER BY date, provider;

-- ============================================================================
-- QUERY: DePIN providers with 95%+ uptime (filtered marketplace)
-- ============================================================================
SELECT
    p.display_name,
    p.slug,
    p.sla_uptime_percent,
    COUNT(i.id) AS gpu_count,
    MIN(i.price_per_gpu_hour) AS min_price
FROM cloudgpus.providers p
LEFT JOIN cloudgpus.instances i ON p.id = i.provider_id AND i.is_active = true
WHERE p.provider_type = 'depin'
  AND (p.sla_uptime_percent >= 95 OR p.sla_uptime_percent IS NULL)
  AND p.is_active = true
GROUP BY p.id
ORDER BY min_price ASC NULLS LAST;

-- ============================================================================
-- QUERY: Price comparison across reliability tiers
-- ============================================================================
SELECT
    p.reliability_tier,
    g.short_name AS gpu,
    COUNT(*) AS instance_count,
    ROUND(AVG(i.price_per_gpu_hour)::numeric, 2) AS avg_price,
    ROUND(MIN(i.price_per_gpu_hour)::numeric, 2) AS min_price,
    ROUND(MAX(i.price_per_gpu_hour)::numeric, 2) AS max_price
FROM cloudgpus.instances i
JOIN cloudgpus.providers p ON i.provider_id = p.id
JOIN cloudgpus.gpu_models g ON i.gpu_model_id = g.id
WHERE i.is_active = true
GROUP BY p.reliability_tier, g.short_name
ORDER BY g.short_name, p.reliability_tier;
```

### 7.2 Admin/Monitoring Queries

```sql
-- ============================================================================
-- QUERY: Scraper health dashboard
-- ============================================================================
SELECT
    p.display_name AS provider,
    sj.status,
    sj.started_at,
    sj.duration_ms,
    sj.instances_found,
    sj.instances_updated,
    sj.error_message,
    EXTRACT(EPOCH FROM (NOW() - p.last_price_update)) / 3600 AS hours_since_update
FROM cloudgpus.providers p
LEFT JOIN LATERAL (
    SELECT * FROM cloudgpus.scrape_jobs sj2
    WHERE sj2.provider_id = p.id
    ORDER BY sj2.started_at DESC
    LIMIT 1
) sj ON true
WHERE p.is_active = true
ORDER BY hours_since_update DESC NULLS FIRST;

-- ============================================================================
-- QUERY: Stale data alert (instances not updated in 24h)
-- ============================================================================
SELECT
    p.display_name AS provider,
    COUNT(*) AS stale_instances,
    MIN(i.last_scraped_at) AS oldest_scrape,
    EXTRACT(EPOCH FROM (NOW() - MIN(i.last_scraped_at))) / 3600 AS hours_stale
FROM cloudgpus.instances i
JOIN cloudgpus.providers p ON i.provider_id = p.id
WHERE i.is_active = true
  AND i.last_scraped_at < NOW() - INTERVAL '24 hours'
GROUP BY p.id
ORDER BY hours_stale DESC;

-- ============================================================================
-- QUERY: Database size monitoring
-- ============================================================================
SELECT
    schemaname,
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'cloudgpus'
ORDER BY pg_total_relation_size(relid) DESC;

-- ============================================================================
-- QUERY: Index usage statistics
-- ============================================================================
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'cloudgpus'
ORDER BY idx_scan DESC;
```

---

## 8. Permissions

```sql
-- ============================================================================
-- PERMISSIONS
-- Grant appropriate access to database roles
-- ============================================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA cloudgpus TO postgres, anon, authenticated, service_role;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA cloudgpus TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA cloudgpus TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA cloudgpus TO service_role;

-- Grant sequence permissions (for UUID generation fallback)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA cloudgpus TO postgres, service_role;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cloudgpus TO postgres, service_role;

-- Future tables get same permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA cloudgpus
    GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cloudgpus
    GRANT ALL ON TABLES TO service_role;
```

---

## Appendix: Complete Migration Script

Save this as a single executable migration file:

```sql
-- File: /opt/docker-projects/cloudgpus/migrations/001_initial_schema.sql
-- Run: psql -h supabase-db -U postgres -d postgres -f 001_initial_schema.sql

\echo 'Starting CloudGPUs schema migration...'
\timing on

-- Include all sections above in order:
-- 1. Schema initialization
-- 2. ENUM types
-- 3. Core tables
-- 4. Triggers and functions
-- 5. Seed data
-- 6. Permissions

\echo 'Migration completed successfully!'
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-30
**Author:** Database Architect Agent
