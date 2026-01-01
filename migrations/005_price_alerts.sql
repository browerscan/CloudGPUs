-- ============================================================================
-- CloudGPUs.io - Price Alert Subscriptions
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: Email subscriptions for price-drop alerts
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.price_alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email TEXT NOT NULL,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES cloudgpus.providers(id) ON DELETE SET NULL,

    -- Trigger threshold (per-GPU hour, USD)
    target_price_per_gpu_hour NUMERIC(10,4) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Double opt-in + unsubscribe
    confirm_token TEXT NOT NULL UNIQUE,
    confirmed_at TIMESTAMPTZ,
    unsubscribe_token TEXT NOT NULL UNIQUE,

    last_notified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_gpu_target
    ON cloudgpus.price_alert_subscriptions(gpu_model_id, target_price_per_gpu_hour);

CREATE INDEX IF NOT EXISTS idx_price_alerts_email
    ON cloudgpus.price_alert_subscriptions(email);

CREATE INDEX IF NOT EXISTS idx_price_alerts_active
    ON cloudgpus.price_alert_subscriptions(is_active) WHERE is_active = true;

-- Public can subscribe/unsubscribe, but cannot read the table.
GRANT INSERT, UPDATE ON cloudgpus.price_alert_subscriptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cloudgpus.price_alert_subscriptions TO postgres, service_role;

COMMIT;

