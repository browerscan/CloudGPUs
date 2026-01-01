-- ============================================================================
-- CloudGPUs.io - Provider Reviews
-- Version: 1.0.0
-- Created: 2025-12-30
-- Description: User-submitted provider reviews and ratings (moderated)
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

CREATE TABLE IF NOT EXISTS cloudgpus.provider_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_id UUID NOT NULL REFERENCES cloudgpus.providers(id) ON DELETE CASCADE,

    rating SMALLINT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,

    author_name TEXT,
    author_email TEXT,

    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cloudgpus.provider_reviews
    ADD CONSTRAINT provider_reviews_rating_range
    CHECK (rating >= 1 AND rating <= 5);

CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider_time
    ON cloudgpus.provider_reviews(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_reviews_published
    ON cloudgpus.provider_reviews(is_published) WHERE is_published = true;

-- Public can submit reviews; only published reviews should be exposed by API.
GRANT INSERT ON cloudgpus.provider_reviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cloudgpus.provider_reviews TO postgres, service_role;

COMMIT;

