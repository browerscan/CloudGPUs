-- ============================================================================
-- CloudGPUs.io - Auth security: token hashes, sessions, audit events
-- Version: 1.0.0
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

-- Token hashes (store hashed tokens instead of plaintext)
ALTER TABLE cloudgpus.users
    ADD COLUMN IF NOT EXISTS verify_token_hash TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS reset_token_hash TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS magic_token_hash TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_verify_token_hash
    ON cloudgpus.users(verify_token_hash) WHERE verify_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash
    ON cloudgpus.users(reset_token_hash) WHERE reset_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_magic_token_hash
    ON cloudgpus.users(magic_token_hash) WHERE magic_token_hash IS NOT NULL;

-- User sessions
CREATE TABLE IF NOT EXISTS cloudgpus.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES cloudgpus.users(id) ON DELETE CASCADE,
    token_id TEXT NOT NULL UNIQUE,
    ip INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
    ON cloudgpus.user_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen
    ON cloudgpus.user_sessions(user_id, last_seen_at DESC);

-- Auth audit events
CREATE TABLE IF NOT EXISTS cloudgpus.auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES cloudgpus.users(id) ON DELETE SET NULL,
    email TEXT,
    ip INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    reason TEXT,
    event_type TEXT NOT NULL DEFAULT 'login',
    risk_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user
    ON cloudgpus.auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_time
    ON cloudgpus.auth_events(ip, created_at DESC) WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_events_email_time
    ON cloudgpus.auth_events(email, created_at DESC) WHERE email IS NOT NULL;

COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. Token hashes are written for all new auth flows; legacy plaintext tokens remain for compatibility
-- 2. Sessions are stored for device management and forced logout
-- 3. Auth events enable login failure auditing and IP risk scoring
