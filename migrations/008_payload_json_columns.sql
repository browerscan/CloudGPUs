-- ============================================================================
-- CloudGPUs.io - PayloadCMS Schema Alignment
-- Version: 1.0.0
-- Created: 2025-12-31
-- Description: Convert list-like TEXT[] columns to JSONB so Payload can manage
--              them without creating relational "hasMany" tables.
-- ============================================================================

BEGIN;

SET search_path TO cloudgpus, public;

-- Providers: convert TEXT[] list fields to JSONB arrays.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cloudgpus'
      AND table_name = 'providers'
      AND column_name = 'available_regions'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE cloudgpus.providers
      ALTER COLUMN available_regions TYPE jsonb
      USING to_jsonb(available_regions);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cloudgpus'
      AND table_name = 'providers'
      AND column_name = 'pros'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE cloudgpus.providers
      ALTER COLUMN pros TYPE jsonb
      USING to_jsonb(pros);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cloudgpus'
      AND table_name = 'providers'
      AND column_name = 'cons'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE cloudgpus.providers
      ALTER COLUMN cons TYPE jsonb
      USING to_jsonb(cons);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cloudgpus'
      AND table_name = 'providers'
      AND column_name = 'best_for'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE cloudgpus.providers
      ALTER COLUMN best_for TYPE jsonb
      USING to_jsonb(best_for);
  END IF;
END $$;

-- GPU models: convert TEXT[] list fields to JSONB arrays.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cloudgpus'
      AND table_name = 'gpu_models'
      AND column_name = 'use_cases'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE cloudgpus.gpu_models
      ALTER COLUMN use_cases TYPE jsonb
      USING to_jsonb(use_cases);
  END IF;
END $$;

COMMIT;

