-- ============================================================================
-- CloudGPUs.io - User Authentication & Accounts
-- Version: 1.0.0
-- Description: User accounts, saved comparisons, and alert linking
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,

    -- Email verification
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verify_token TEXT UNIQUE,
    verify_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,

    -- Password reset
    reset_token TEXT UNIQUE,
    reset_expires_at TIMESTAMPTZ,

    -- Session management
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON cloudgpus.users(email);
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON cloudgpus.users(verify_token) WHERE verify_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON cloudgpus.users(reset_token) WHERE reset_token IS NOT NULL;

-- ============================================================================
-- SAVED COMPARISONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cloudgpus.saved_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES cloudgpus.users(id) ON DELETE CASCADE,

    -- Comparison type: 'gpu' or 'provider'
    comparison_type TEXT NOT NULL CHECK (comparison_type IN ('gpu', 'provider')),

    -- For GPU comparisons: slug of GPU being compared
    -- For provider comparisons: comma-separated provider slugs
    comparison_key TEXT NOT NULL,

    -- Flexible JSON storage for comparison data
    items JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- User-friendly name (optional)
    name TEXT,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT saved_comparisons_unique UNIQUE (user_id, comparison_type, comparison_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_comparisons_user ON cloudgpus.saved_comparisons(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_saved_comparisons_type ON cloudgpus.saved_comparisons(comparison_type);

-- ============================================================================
-- UPDATE EXISTING ALERTS TO LINK TO USERS
-- ============================================================================
-- Add user_id column to price_alert_subscriptions (nullable for backward compatibility)
ALTER TABLE cloudgpus.price_alert_subscriptions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES cloudgpus.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_price_alerts_user
    ON cloudgpus.price_alert_subscriptions(user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS update_users_timestamp ON cloudgpus.users;
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON cloudgpus.users
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

DROP TRIGGER IF EXISTS update_saved_comparisons_timestamp ON cloudgpus.saved_comparisons;
CREATE TRIGGER update_saved_comparisons_timestamp
    BEFORE UPDATE ON cloudgpus.saved_comparisons
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Authenticated users can manage their own data via API (enforced at app level)
GRANT SELECT, INSERT, UPDATE ON cloudgpus.users TO authenticated;
GRANT USAGE ON SEQUENCE cloudgpus.users_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON cloudgpus.saved_comparisons TO authenticated;
GRANT USAGE ON SEQUENCE cloudgpus.saved_comparisons_id_seq TO authenticated;

COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. Existing price_alert_subscriptions without user_id remain valid (email-based)
-- 2. New alerts from authenticated users will have user_id set
-- 3. Users can claim their existing email alerts via a migration function
