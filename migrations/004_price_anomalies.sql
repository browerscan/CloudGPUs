-- ============================================================================
-- CloudGPUs.io - Price Anomaly Tracking
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: Detect and persist suspicious price changes for alerting/QA
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.price_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to the price_history record that triggered this anomaly
    price_history_id UUID NOT NULL UNIQUE REFERENCES cloudgpus.price_history(id) ON DELETE CASCADE,

    instance_id UUID NOT NULL REFERENCES cloudgpus.instances(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,
    gpu_model_id UUID NOT NULL REFERENCES cloudgpus.gpu_models(id) ON DELETE CASCADE,

    old_price_per_gpu_hour NUMERIC(10,4),
    new_price_per_gpu_hour NUMERIC(10,4) NOT NULL,
    change_percent NUMERIC(10,2),

    status TEXT NOT NULL DEFAULT 'open',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,

    CONSTRAINT price_anomalies_status_check
      CHECK (status IN ('open', 'ignored', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_price_anomalies_provider_time
    ON cloudgpus.price_anomalies(provider_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_anomalies_gpu_time
    ON cloudgpus.price_anomalies(gpu_model_id, detected_at DESC);

-- Permissions: anomalies are internal/ops-only
GRANT SELECT, INSERT, UPDATE ON cloudgpus.price_anomalies TO postgres, service_role;

COMMIT;

