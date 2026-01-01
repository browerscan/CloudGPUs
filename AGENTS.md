# Repository Guidelines

## Project Structure & Module Organization

- `src/`: API server (Express) + admin UI + workers (BullMQ) + DB/Redis clients.
- `cms/`: PayloadCMS Admin (Next.js) served by the API at `/admin` and `/payload-api`.
- `frontend/`: Next.js App Router site (pSEO pages, calculators, alerts UX).
- `migrations/`: numbered SQL migrations applied via `pnpm db:migrate`.
- `tests/`: Vitest + Supertest API tests.
- `docs/`: PRD, architecture, SEO strategy, and execution plans.
- `scripts/`: operational scripts (e.g. backups, IndexNow submission).
- `docker-compose.yml` / `Dockerfile*`: production images + worker topology; `docker-compose.local.yml` runs local Postgres/Redis.

## Build, Test, and Development Commands

Backend (API/workers):

- `pnpm dev` — run API in watch mode on `PORT` (default `3000`).
- `pnpm build && pnpm start` — build TypeScript to `dist/` and run production server.
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — quality gates.
- `pnpm db:migrate` / `pnpm db:seed` — apply SQL migrations + seed GPUs/providers.

Local deps:

- `docker compose -f docker-compose.local.yml up -d` — Postgres on `5433`, Redis on `6380`.

Frontend:

- `pnpm -C frontend dev` — Next dev server on `4000`.
- `pnpm -C frontend typecheck && pnpm -C frontend build` — production build validation.

## Coding Style & Naming Conventions

- TypeScript-first; prefer small, composable modules and explicit types for API payloads.
- Formatting: Prettier (`pnpm format`). Linting: ESLint (`pnpm lint`).
- SQL migrations: `migrations/NNN_description.sql` (forward-only; include safe defaults and indexes).

## Testing Guidelines

- Framework: Vitest (`pnpm test`), with API route tests using Supertest.
- Add new tests next to existing patterns in `tests/*.test.ts` and keep external IO mocked unless doing a Docker smoke run.

## Commit & Pull Request Guidelines

- This checkout may not include `.git`, so commit conventions can’t be inferred; use Conventional Commits (e.g., `api: …`, `frontend: …`, `workers: …`, `db: …`).
- PRs should include: scope, verification steps (commands run), screenshots for UI changes, and any `.env`/migration updates.

## Security & Configuration Tips

- Never commit secrets (`.env`, API keys, SMTP creds). Update `.env.example` when adding new env vars.
- Protect ops endpoints (`/ops`) with `ADMIN_USER`/`ADMIN_PASSWORD`; PayloadCMS Admin is served at `/admin` and uses Payload auth. Protect affiliate postbacks with `AFFILIATE_POSTBACK_SECRET`.
- IndexNow: set `INDEXNOW_KEY` to match a hosted key file (see `frontend/public/*.txt`) and use `scripts/indexnow-submit.ts` to submit sitemap URLs.
