# CloudGPUs.io Test Strategy

This repo uses a layered testing approach: fast unit tests for core logic, API-level tests for key routes, and “real stack” smoke checks with Postgres + Redis.

## Unit tests (fast)

- Framework: Vitest (`vitest.config.ts`)
- Run: `pnpm test`
- Coverage: `pnpm test:coverage`

Unit tests should avoid real network calls. Use dependency injection (e.g. `createApp({ pool, redis })`) and mocks for Postgres/Redis.

## API route tests

Current tests are API-level and validate:

- `/api/health`
- `/api/stats/cheapest` cache behavior
- `/api/affiliate/click` redirect + logging

Add new route tests under `tests/*.test.ts` using `supertest` and mocked dependencies.

## Integration smoke checks (local Docker)

Use this when changing SQL schema, workers, or job scheduling.

1. Start dependencies: `docker compose -f docker-compose.local.yml up -d`
2. Configure `.env` to point at local Postgres/Redis.
3. Apply migrations/seed: `pnpm build && pnpm db:migrate && pnpm db:seed`
4. Start API: `pnpm dev`
5. Start workers (in a second terminal):
   - `WORKER_QUEUES=default,maintenance pnpm dev`
   - `WORKER_QUEUES=pricing-fetch pnpm dev`
6. Quick checks:
   - `curl -fsS http://localhost:3000/api/health`
   - Load a few pages locally by pointing `NEXT_PUBLIC_API_BASE_URL` at the API.

## Frontend validation

- Typecheck: `pnpm -C frontend typecheck`
- Build: `pnpm -C frontend build`

The frontend is built to tolerate API outages during `next build` (pages catch API failures and render fallbacks).
