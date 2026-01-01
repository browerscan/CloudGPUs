-- ============================================================================
-- CloudGPUs.io - Affiliate Click Tracking
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: Track outbound affiliate clicks for attribution
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID REFERENCES cloudgpus.gpu_models(id) ON DELETE SET NULL,
    instance_id UUID REFERENCES cloudgpus.instances(id) ON DELETE SET NULL,

    session_id VARCHAR(64),
    ip INET,
    user_agent TEXT,
    referrer TEXT,

    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_provider_time
    ON cloudgpus.affiliate_clicks(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_gpu_time
    ON cloudgpus.affiliate_clicks(gpu_model_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session_time
    ON cloudgpus.affiliate_clicks(session_id, created_at DESC);

-- Permissions
GRANT SELECT, INSERT ON cloudgpus.affiliate_clicks TO anon, authenticated;
GRANT ALL ON cloudgpus.affiliate_clicks TO postgres, service_role;

COMMIT;

