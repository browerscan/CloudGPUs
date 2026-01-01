-- ============================================================================
-- CloudGPUs.io - Affiliate Conversion Tracking
-- Version: 1.0.0
-- Created: 2025-12-31
-- Description: Track affiliate conversions / revenue via postback or manual import
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.affiliate_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    affiliate_click_id UUID REFERENCES cloudgpus.affiliate_clicks(id) ON DELETE SET NULL,

    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',

    revenue_amount NUMERIC(12,4),
    commission_amount NUMERIC(12,4),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',

    occurred_at TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_provider_time
    ON cloudgpus.affiliate_conversions(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_click_time
    ON cloudgpus.affiliate_conversions(affiliate_click_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_conversions_provider_external
    ON cloudgpus.affiliate_conversions(provider_id, external_id)
    WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT ON cloudgpus.affiliate_conversions TO anon, authenticated;
GRANT ALL ON cloudgpus.affiliate_conversions TO postgres, service_role;

COMMIT;

