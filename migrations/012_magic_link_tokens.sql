-- ============================================================================
-- CloudGPUs.io - Magic link tokens for passwordless login
-- Version: 1.0.0
-- Description: Add magic_token and magic_expires_at to users
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

ALTER TABLE cloudgpus.users
    ADD COLUMN IF NOT EXISTS magic_token TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS magic_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_magic_token
    ON cloudgpus.users(magic_token) WHERE magic_token IS NOT NULL;

COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. magic_token is used for passwordless login links
-- 2. Tokens are single-use and cleared after login
