# CloudGPUs.io Scraper Guide

CloudGPUs.io collects GPU pricing via BullMQ workers and normalizes results into `cloudgpus.instances` (current state) and `cloudgpus.price_history` (time series).

## How scraping works

- Queue: `pricing-fetch` runs per-provider scrapes (`src/workers/pricing/processor.ts`).
- Adapter selection: `src/workers/adapters/registry.ts` chooses an adapter based on `SCRAPER_MODE`, provider metadata, and available API keys.
- Resilience:
  - Per-provider circuit breaker (`src/workers/circuit-breaker.ts`).
  - Anomaly detection inserts into `cloudgpus.price_anomalies` when price changes exceed 50%.
- Storage:
  - Upserts current instances (deactivates stale rows for a provider).
  - Trigger records `price_history` rows on instance updates (see `migrations/001_initial_schema.sql`).

## Scraper modes

Set `SCRAPER_MODE` in `.env`:

- `hybrid` (default): prefer provider APIs when keys exist → heuristic scrape pricing pages → static fallback.
- `live`: disable static fallback (missing provider support yields empty results).
- `static`: deterministic fixture-like pricing (useful for repeatable builds/tests).

## Running locally

1. Start infra: `docker compose -f docker-compose.local.yml up -d`
2. Copy env: `cp .env.example .env` and configure `DATABASE_URI`, `REDIS_URL`.
3. Apply schema: `pnpm build && pnpm db:migrate && pnpm db:seed`
4. Start worker:
   - `WORKER_QUEUES=pricing-fetch WORKER_CONCURRENCY=3 pnpm dev`
   - Or run the compiled worker: `pnpm build && node dist/workers/index.js`

## Adding a new provider adapter

1. Add provider metadata to the DB (`cloudgpus.providers`), including `slug`, `pricing_url`, and tier/type.
2. Implement an adapter in `src/workers/adapters/`:
   - Export a class that implements `ProviderAdapter` (`src/workers/adapters/types.ts`).
   - Implement `fetchPricing({ provider, now, scrape })` and return normalized instances.
3. Register the adapter in `src/workers/adapters/registry.ts` (prefer API adapters when keys exist).
4. Validate output:
   - Run one scrape and verify rows in `cloudgpus.instances`.
   - Confirm price history writes and `scrape_jobs` status updates.

## Browser scraping (dynamic pages)

Some providers require browser rendering. The pricing worker can offload to the `browser-scrape` queue via the `ScrapeClient` (`src/workers/scrape/client.ts`), which is handled by the Playwright “browser worker” image (`Dockerfile.browser`).
