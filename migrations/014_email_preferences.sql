-- ============================================================================
-- CloudGPUs.io - Email preferences
-- Version: 1.0.0
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.email_preferences (
    email TEXT PRIMARY KEY,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT true,
    product_updates_opt_in BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_email_preferences_timestamp ON cloudgpus.email_preferences;
CREATE TRIGGER update_email_preferences_timestamp
    BEFORE UPDATE ON cloudgpus.email_preferences
    FOR EACH ROW EXECUTE FUNCTION cloudgpus.update_timestamp();

COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. Transactional emails (verification/reset/alerts) are always sent
-- 2. Preferences apply to optional marketing and product update emails
