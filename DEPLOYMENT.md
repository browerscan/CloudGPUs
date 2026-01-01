# CloudGPUs.io Production Deployment Guide

## Architecture Overview

```
                                    +------------------+
                                    |  Cloudflare CDN  |
                                    |  cloudgpus.io    |
                                    +--------+---------+
                                             |
                    +------------------------+------------------------+
                    |                                                 |
           +--------v--------+                               +--------v--------+
           | Cloudflare Pages|                               |   nginx-proxy   |
           |    (Frontend)   |                               | 107.174.42.198  |
           +-----------------+                               +--------+--------+
                                                                      |
                                    +---------------------------------+
                                    |
                         +----------v-----------+
                         |     PayloadCMS API   |
                         |  api.cloudgpus.io    |
                         +----------+-----------+
                                    |
          +------------+------------+------------+------------+
          |            |            |            |            |
    +-----v----+ +-----v----+ +-----v----+ +-----v----+ +-----v----+
    |  Worker  | |  Worker  | |  Worker  | |  Worker  | | Browser  |
    |  Pricing | |   API    | |  Notify  | |  Default | |  Worker  |
    +-----+----+ +-----+----+ +-----+----+ +-----+----+ +-----+----+
          |            |            |            |            |
          +------------+------------+------------+------------+
                                    |
                    +---------------+---------------+
                    |                               |
             +------v------+                +-------v-------+
             |    Redis    |                |  PostgreSQL   |
             | (BullMQ)    |                |  supabase-db  |
             +-------------+                +---------------+
```

## Infrastructure Details

| Component      | Host                | Port   | Network                               |
| -------------- | ------------------- | ------ | ------------------------------------- |
| nginx-proxy    | 107.174.42.198      | 80/443 | nginx-proxy_default                   |
| PostgreSQL     | supabase-db         | 5432   | supabase_default                      |
| Redis          | redis               | 6379   | redis_default                         |
| PayloadCMS API | cloudgpus-api       | 3000   | nginx-proxy_default, supabase_default |
| Workers        | cloudgpus-worker-\* | -      | supabase_default, redis_default       |

## Project Structure

```
/opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/
├── docker-compose.yml          # Main orchestration
├── docker-compose.override.yml # Development overrides
├── .env                        # Environment variables (gitignored)
├── .env.example                # Template for environment
├── Makefile                    # Operations commands
├── Dockerfile                  # Multi-stage build
├── Dockerfile.browser          # Playwright browser worker
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline
├── src/                        # PayloadCMS source
├── workers/                    # BullMQ worker definitions
├── data/                       # Persistent data (bind mount)
├── logs/                       # Application logs
└── backups/                    # Database backups
```

---

## 1. Docker Compose Configuration

### docker-compose.yml

```yaml
version: "3.8"

x-common-env: &common-env
  NODE_ENV: production
  PAYLOAD_SECRET: ${PAYLOAD_SECRET}
  DATABASE_URI: postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/postgres?schema=cloudgpus
  REDIS_URL: redis://redis:6379/0
  LOG_LEVEL: ${LOG_LEVEL:-info}

x-worker-base: &worker-base
  build:
    context: .
    dockerfile: Dockerfile
    target: worker
  restart: unless-stopped
  env_file: .env
  environment:
    <<: *common-env
  networks:
    - supabase-tier
    - redis-tier
    - internal
  depends_on:
    api:
      condition: service_healthy
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: "1.0"
      reservations:
        memory: 256M
  logging:
    driver: "json-file"
    options:
      max-size: "20m"
      max-file: "3"

services:
  # ===========================================
  # PayloadCMS API (Main Backend)
  # ===========================================
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: cloudgpus-api
    restart: unless-stopped
    env_file: .env
    environment:
      <<: *common-env
      VIRTUAL_HOST: api.cloudgpus.io
      LETSENCRYPT_HOST: api.cloudgpus.io
      LETSENCRYPT_EMAIL: ${ADMIN_EMAIL:-admin@cloudgpus.io}
      VIRTUAL_PORT: 3000
      CORS_ORIGINS: https://cloudgpus.io,https://www.cloudgpus.io
      # PayloadCMS specific
      PAYLOAD_PUBLIC_SERVER_URL: https://api.cloudgpus.io
      PAYLOAD_CONFIG_PATH: dist/payload.config.js
    volumes:
      - ./data/uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - proxy-tier
      - supabase-tier
      - redis-tier
      - internal
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
        reservations:
          memory: 1G
    stop_grace_period: 30s
    healthcheck:
      test:
        ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  # ===========================================
  # BullMQ Workers (by queue type)
  # ===========================================

  # Pricing Worker - Fetches GPU pricing from provider APIs
  worker-pricing:
    <<: *worker-base
    container_name: cloudgpus-worker-pricing
    environment:
      <<: *common-env
      WORKER_QUEUES: pricing-fetch,pricing-aggregate
      WORKER_CONCURRENCY: 5
      # Provider API Keys
      LAMBDA_API_KEY: ${LAMBDA_API_KEY}
      RUNPOD_API_KEY: ${RUNPOD_API_KEY}
      VASTAI_API_KEY: ${VASTAI_API_KEY}
      COREWEAVE_API_KEY: ${COREWEAVE_API_KEY}
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: "1.5"
    healthcheck:
      test: ["CMD-SHELL", 'node -e "require(''./dist/workers/health'').check()" || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3

  # API Worker - Handles provider API sync tasks
  worker-api:
    <<: *worker-base
    container_name: cloudgpus-worker-api
    environment:
      <<: *common-env
      WORKER_QUEUES: api-sync,provider-update
      WORKER_CONCURRENCY: 3
    healthcheck:
      test: ["CMD-SHELL", 'node -e "require(''./dist/workers/health'').check()" || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3

  # Notification Worker - Sends alerts and notifications
  worker-notify:
    <<: *worker-base
    container_name: cloudgpus-worker-notify
    environment:
      <<: *common-env
      WORKER_QUEUES: email,webhook,slack
      WORKER_CONCURRENCY: 10
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    healthcheck:
      test: ["CMD-SHELL", 'node -e "require(''./dist/workers/health'').check()" || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3

  # Default Worker - Catches all other queues
  worker-default:
    <<: *worker-base
    container_name: cloudgpus-worker-default
    environment:
      <<: *common-env
      WORKER_QUEUES: default,maintenance,cleanup
      WORKER_CONCURRENCY: 5
    healthcheck:
      test: ["CMD-SHELL", 'node -e "require(''./dist/workers/health'').check()" || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3

  # ===========================================
  # Browser Worker (Playwright - Resource Heavy)
  # ===========================================
  worker-browser:
    build:
      context: .
      dockerfile: Dockerfile.browser
    container_name: cloudgpus-worker-browser
    restart: unless-stopped
    env_file: .env
    environment:
      <<: *common-env
      WORKER_QUEUES: browser-scrape,screenshot
      WORKER_CONCURRENCY: 2
      PLAYWRIGHT_BROWSERS_PATH: /ms-playwright
      # Security: Run browser in sandbox
      BROWSER_SANDBOX: "true"
    volumes:
      - ./data/screenshots:/app/screenshots
    networks:
      - supabase-tier
      - redis-tier
      - internal
    depends_on:
      api:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "2.0"
        reservations:
          memory: 2G
    shm_size: "2gb"
    security_opt:
      - seccomp:unconfined
    stop_grace_period: 60s
    healthcheck:
      test: ["CMD-SHELL", 'node -e "require(''./dist/workers/browser-health'').check()" || exit 1']
      interval: 60s
      timeout: 30s
      retries: 3
      start_period: 120s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

# ===========================================
# Networks
# ===========================================
networks:
  proxy-tier:
    external: true
    name: nginx-proxy_default
  supabase-tier:
    external: true
    name: supabase_default
  redis-tier:
    external: true
    name: redis_default
  internal:
    driver: bridge
    internal: true
```

### Dockerfile (Multi-stage)

```dockerfile
# ===========================================
# Base Stage
# ===========================================
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# ===========================================
# Dependencies Stage
# ===========================================
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ===========================================
# Build Stage
# ===========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build PayloadCMS
RUN corepack enable pnpm && pnpm build

# ===========================================
# Production Stage (API)
# ===========================================
FROM node:20-alpine AS production
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 payload

# Copy built assets
COPY --from=builder --chown=payload:nodejs /app/dist ./dist
COPY --from=builder --chown=payload:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=payload:nodejs /app/package.json ./

# Create directories
RUN mkdir -p uploads logs && chown -R payload:nodejs uploads logs

USER payload

EXPOSE 3000

ENV NODE_ENV=production
ENV PAYLOAD_CONFIG_PATH=dist/payload.config.js

CMD ["node", "dist/server.js"]

# ===========================================
# Worker Stage
# ===========================================
FROM node:20-alpine AS worker
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/package.json ./

USER worker

ENV NODE_ENV=production

CMD ["node", "dist/workers/index.js"]
```

### Dockerfile.browser (Playwright)

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Security: Create non-root user
RUN groupadd --system --gid 1001 pwuser \
    && useradd --system --uid 1001 --gid pwuser pwuser

# Copy application
COPY --chown=pwuser:pwuser dist ./dist
COPY --chown=pwuser:pwuser node_modules ./node_modules
COPY --chown=pwuser:pwuser package.json ./

# Create directories
RUN mkdir -p screenshots && chown -R pwuser:pwuser screenshots

USER pwuser

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "dist/workers/browser.js"]
```

---

## 2. Environment Variables

### .env.example

```bash
# ===========================================
# CloudGPUs.io Environment Configuration
# ===========================================

# --- Core Settings ---
NODE_ENV=production
LOG_LEVEL=info
ADMIN_EMAIL=admin@cloudgpus.io

# --- PayloadCMS ---
PAYLOAD_SECRET=your-super-secret-key-min-32-chars
PAYLOAD_PUBLIC_SERVER_URL=https://api.cloudgpus.io

# --- Database (Supabase PostgreSQL) ---
DB_PASSWORD=your-supabase-db-password
DATABASE_URI=postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/postgres?schema=cloudgpus

# --- Redis (BullMQ) ---
REDIS_URL=redis://redis:6379/0

# --- CORS Origins (comma-separated) ---
CORS_ORIGINS=https://cloudgpus.io,https://www.cloudgpus.io

# ===========================================
# GPU Provider API Keys
# ===========================================

# Lambda Labs
LAMBDA_API_KEY=

# RunPod
RUNPOD_API_KEY=

# Vast.ai
VASTAI_API_KEY=

# CoreWeave (Kubernetes config path or token)
COREWEAVE_API_KEY=

# Nebius
NEBIUS_API_KEY=

# GMI Cloud
GMI_API_KEY=

# Voltage Park
VOLTAGEPARK_API_KEY=

# io.net
IONET_API_KEY=

# ===========================================
# Notifications
# ===========================================

# SMTP (for email alerts)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=

# Slack Webhook (for alerts)
SLACK_WEBHOOK_URL=

# ===========================================
# Cloudflare R2 (File Storage)
# ===========================================
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=cloudgpus-uploads
R2_PUBLIC_URL=https://cdn.cloudgpus.io

# ===========================================
# Monitoring
# ===========================================
SENTRY_DSN=
```

### Secret Management Strategy

| Secret Type          | Storage                          | Access Method          |
| -------------------- | -------------------------------- | ---------------------- |
| Database credentials | `.env` (server)                  | Environment variable   |
| API keys             | `.env` (server) + GitHub Secrets | CI/CD injection        |
| PayloadCMS secret    | `.env` (server)                  | 32+ char random string |
| SMTP credentials     | `.env` (server)                  | Environment variable   |

**Security Rules:**

1. Never commit `.env` files
2. Rotate secrets quarterly
3. Use separate keys per environment
4. Audit API key usage monthly

---

## 3. Makefile Commands

```makefile
# ===========================================
# CloudGPUs.io Makefile
# ===========================================

.PHONY: help deploy logs down shell db-backup db-restore validate build test clean

# Project config
PROJECT_NAME := cloudgpus
COMPOSE_FILE := docker-compose.yml
BACKUP_DIR := ./backups
SCHEMA := cloudgpus

# Colors
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

help:
	@echo "$(GREEN)CloudGPUs.io Operations$(NC)"
	@echo "========================"
	@echo ""
	@echo "$(YELLOW)Deployment:$(NC)"
	@echo "  make deploy        - Build and deploy all services"
	@echo "  make deploy-api    - Deploy API only"
	@echo "  make deploy-workers- Deploy workers only"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo ""
	@echo "$(YELLOW)Monitoring:$(NC)"
	@echo "  make logs          - View all logs (follow)"
	@echo "  make logs-api      - View API logs"
	@echo "  make logs-workers  - View worker logs"
	@echo "  make status        - Show service status"
	@echo "  make health        - Check health endpoints"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make db-backup     - Backup database schema"
	@echo "  make db-restore    - Restore from latest backup"
	@echo "  make db-migrate    - Run database migrations"
	@echo "  make db-shell      - Connect to PostgreSQL"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make shell         - Enter API container shell"
	@echo "  make shell-worker  - Enter worker container shell"
	@echo "  make build         - Build images without deploy"
	@echo "  make validate      - Validate compose file"
	@echo "  make clean         - Remove unused images/volumes"
	@echo ""

# ===========================================
# Deployment Commands
# ===========================================

deploy: validate
	@echo "$(GREEN)Deploying CloudGPUs.io...$(NC)"
	@docker compose -f $(COMPOSE_FILE) pull --ignore-pull-failures
	@docker compose -f $(COMPOSE_FILE) build --parallel
	@docker compose -f $(COMPOSE_FILE) up -d --remove-orphans
	@echo "$(GREEN)Deployment complete!$(NC)"
	@$(MAKE) status

deploy-api: validate
	@echo "$(GREEN)Deploying API...$(NC)"
	@docker compose -f $(COMPOSE_FILE) up -d --build api
	@docker compose -f $(COMPOSE_FILE) logs -f api

deploy-workers: validate
	@echo "$(GREEN)Deploying Workers...$(NC)"
	@docker compose -f $(COMPOSE_FILE) up -d --build \
		worker-pricing worker-api worker-notify worker-default worker-browser

down:
	@echo "$(YELLOW)Stopping services...$(NC)"
	@docker compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)Services stopped$(NC)"

restart:
	@echo "$(YELLOW)Restarting services...$(NC)"
	@docker compose -f $(COMPOSE_FILE) restart
	@$(MAKE) status

# ===========================================
# Monitoring Commands
# ===========================================

logs:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100

logs-api:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100 api

logs-workers:
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100 \
		worker-pricing worker-api worker-notify worker-default worker-browser

status:
	@echo "$(GREEN)Service Status:$(NC)"
	@docker compose -f $(COMPOSE_FILE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

health:
	@echo "$(GREEN)Health Checks:$(NC)"
	@echo "API: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo 'DOWN')"
	@docker compose -f $(COMPOSE_FILE) ps --format "{{.Name}}: {{.Health}}"

# ===========================================
# Database Commands
# ===========================================

db-backup:
	@echo "$(GREEN)Backing up database schema '$(SCHEMA)'...$(NC)"
	@mkdir -p $(BACKUP_DIR)
	@docker exec supabase-db pg_dump -U postgres -n $(SCHEMA) --no-owner --no-acl \
		> $(BACKUP_DIR)/$(SCHEMA)_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup saved to $(BACKUP_DIR)/$(NC)"
	@ls -lh $(BACKUP_DIR)/*.sql | tail -5

db-restore:
	@echo "$(YELLOW)Available backups:$(NC)"
	@ls -lt $(BACKUP_DIR)/*.sql 2>/dev/null | head -5 || echo "No backups found"
	@echo ""
	@read -p "Enter backup filename: " file; \
	if [ -f "$(BACKUP_DIR)/$$file" ]; then \
		echo "$(YELLOW)Restoring from $$file...$(NC)"; \
		docker exec -i supabase-db psql -U postgres < $(BACKUP_DIR)/$$file; \
		echo "$(GREEN)Restore complete$(NC)"; \
	else \
		echo "$(RED)File not found$(NC)"; \
	fi

db-migrate:
	@echo "$(GREEN)Running database migrations...$(NC)"
	@docker compose -f $(COMPOSE_FILE) exec api node dist/migrations/run.js

db-shell:
	@docker exec -it supabase-db psql -U postgres -d postgres

# ===========================================
# Development Commands
# ===========================================

shell:
	@docker compose -f $(COMPOSE_FILE) exec api sh

shell-worker:
	@docker compose -f $(COMPOSE_FILE) exec worker-pricing sh

build:
	@echo "$(GREEN)Building images...$(NC)"
	@docker compose -f $(COMPOSE_FILE) build --parallel

validate:
	@echo "$(GREEN)Validating compose file...$(NC)"
	@docker compose -f $(COMPOSE_FILE) config --quiet && echo "$(GREEN)Valid!$(NC)"

clean:
	@echo "$(YELLOW)Cleaning unused Docker resources...$(NC)"
	@docker image prune -f
	@docker network prune -f
	@echo "$(GREEN)Cleanup complete$(NC)"

# ===========================================
# Quick Operations
# ===========================================

# Scale workers
scale-workers:
	@read -p "Number of pricing workers (default 1): " n; \
	docker compose -f $(COMPOSE_FILE) up -d --scale worker-pricing=$${n:-1}

# View BullMQ dashboard
bullmq-ui:
	@echo "BullMQ Dashboard: https://api.cloudgpus.io/ops/queues"

# Emergency stop
emergency-stop:
	@echo "$(RED)EMERGENCY STOP - Stopping all containers$(NC)"
	@docker compose -f $(COMPOSE_FILE) stop
	@docker compose -f $(COMPOSE_FILE) ps
```

---

## 4. CI/CD Pipeline

### .github/workflows/deploy.yml

```yaml
name: Deploy CloudGPUs.io

on:
  push:
    branches: [main]
    paths-ignore:
      - "*.md"
      - "docs/**"
  workflow_dispatch:
    inputs:
      environment:
        description: "Deployment environment"
        required: true
        default: "production"
        type: choice
        options:
          - production
          - staging

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ===========================================
  # Test Stage
  # ===========================================
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run type check
        run: pnpm typecheck

      - name: Run linter
        run: pnpm lint

      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URI: postgresql://postgres:postgres@localhost:5432/test?schema=cloudgpus
          PAYLOAD_SECRET: test-secret-key-for-testing-only

  # ===========================================
  # Build Stage
  # ===========================================
  build:
    name: Build & Push
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}

      # Build API image
      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          target: production
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Build Worker image
      - name: Build and push Worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          target: worker
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Build Browser Worker image
      - name: Build and push Browser Worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.browser
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/browser-worker:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ===========================================
  # Deploy Stage
  # ===========================================
  deploy:
    name: Deploy to Production
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io

            # Pull latest changes
            git pull origin main

            # Update image tags
            export IMAGE_TAG=${{ github.sha }}

            # Deploy with zero-downtime
            docker compose pull
            docker compose up -d --remove-orphans

            # Wait for health checks
            sleep 30

            # Verify deployment
            if curl -sf http://localhost:3000/api/health > /dev/null; then
              echo "Deployment successful!"
            else
              echo "Health check failed - rolling back"
              docker compose rollback
              exit 1
            fi

            # Cleanup old images
            docker image prune -f

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          fields: repo,message,commit,author,action,eventName,ref,workflow
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  # ===========================================
  # Rollback (Manual Trigger)
  # ===========================================
  rollback:
    name: Rollback
    if: github.event_name == 'workflow_dispatch' && failure()
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Rollback deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io

            # Get previous commit
            PREV_COMMIT=$(git rev-parse HEAD~1)

            # Checkout previous version
            git checkout $PREV_COMMIT

            # Redeploy
            docker compose up -d --remove-orphans

            echo "Rolled back to $PREV_COMMIT"
```

### GitHub Secrets Required

| Secret              | Description                |
| ------------------- | -------------------------- |
| `SERVER_HOST`       | 107.174.42.198             |
| `SERVER_USER`       | root                       |
| `SERVER_SSH_KEY`    | SSH private key            |
| `SLACK_WEBHOOK_URL` | Slack notification webhook |

---

## 5. Monitoring & Logging

### Health Check Endpoints

Create `src/endpoints/health.ts`:

```typescript
import { Endpoint } from "payload/config";
import { Queue } from "bullmq";

export const healthEndpoint: Endpoint = {
  path: "/health",
  method: "get",
  handler: async (req, res) => {
    const checks = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: false,
        redis: false,
        queues: {} as Record<string, number>,
      },
    };

    try {
      // Check database
      await req.payload.find({
        collection: "providers",
        limit: 1,
      });
      checks.checks.database = true;
    } catch (e) {
      checks.status = "degraded";
    }

    try {
      // Check Redis/BullMQ
      const queues = ["pricing-fetch", "api-sync", "email", "browser-scrape"];
      for (const queueName of queues) {
        const queue = new Queue(queueName);
        const waiting = await queue.getWaitingCount();
        checks.checks.queues[queueName] = waiting;
        await queue.close();
      }
      checks.checks.redis = true;
    } catch (e) {
      checks.status = "degraded";
    }

    const statusCode = checks.status === "ok" ? 200 : 503;
    res.status(statusCode).json(checks);
  },
};
```

### Dozzle Integration (Existing)

Access logs at: `https://logs.expertbeacon.com`

Filter by container:

- `cloudgpus-api`
- `cloudgpus-worker-*`

### Alert Thresholds

| Metric            | Warning     | Critical      |
| ----------------- | ----------- | ------------- |
| API Response Time | > 2s        | > 5s          |
| Queue Backlog     | > 100       | > 500         |
| Memory Usage      | > 80%       | > 95%         |
| Error Rate        | > 1%        | > 5%          |
| Worker Health     | 1 unhealthy | > 2 unhealthy |

### Uptime Kuma Monitors

Add to `https://uptime.expertbeacon.com`:

1. **API Health**: `https://api.cloudgpus.io/api/health`
2. **Frontend**: `https://cloudgpus.io`
3. **Database**: TCP check on `supabase-db:5432`

---

## 6. Cloudflare Pages Setup

### Build Configuration

In Cloudflare Pages dashboard:

| Setting                | Value        |
| ---------------------- | ------------ |
| Framework preset       | Next.js      |
| Build command          | `pnpm build` |
| Build output directory | `.next`      |
| Root directory         | `/frontend`  |
| Node.js version        | 20           |

### Environment Variables

| Variable               | Value                      | Type  |
| ---------------------- | -------------------------- | ----- |
| `NEXT_PUBLIC_API_URL`  | `https://api.cloudgpus.io` | Plain |
| `NEXT_PUBLIC_SITE_URL` | `https://cloudgpus.io`     | Plain |
| `NEXT_PUBLIC_GA_ID`    | `G-XXXXXXXXXX`             | Plain |

### Custom Domain Setup

1. Add custom domain: `cloudgpus.io`
2. Add www redirect: `www.cloudgpus.io` -> `cloudgpus.io`
3. Enable Always Use HTTPS
4. Enable Auto Minify (HTML, CSS, JS)

### Cache Rules

Create Page Rule for API bypass:

```
URL: cloudgpus.io/api/*
Cache Level: Bypass
```

Create Cache Rule for static assets:

```
URL: cloudgpus.io/_next/static/*
Edge TTL: 1 month
Browser TTL: 1 year
```

### wrangler.toml (if using Workers)

```toml
name = "cloudgpus-frontend"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

[vars]
NEXT_PUBLIC_API_URL = "https://api.cloudgpus.io"
```

---

## 7. Backup Strategy

### Database Backup Schedule

Create `/opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/scripts/backup.sh`:

```bash
#!/bin/bash
# CloudGPUs.io Database Backup Script

set -e

BACKUP_DIR="/opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/backups"
SCHEMA="cloudgpus"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${SCHEMA}_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of schema: $SCHEMA"

# Dump database
docker exec supabase-db pg_dump -U postgres -n "$SCHEMA" --no-owner --no-acl > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Upload to R2 (if configured)
if [ -n "$R2_BUCKET_NAME" ]; then
    aws s3 cp "${BACKUP_FILE}.gz" "s3://${R2_BUCKET_NAME}/backups/" \
        --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup complete: ${BACKUP_FILE}.gz"
```

### Cron Schedule

Add to server crontab (`crontab -e`):

```cron
# CloudGPUs.io backups
# Daily at 3 AM
0 3 * * * /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/scripts/backup.sh >> /var/log/cloudgpus-backup.log 2>&1

# Weekly full backup on Sunday at 2 AM
0 2 * * 0 /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/scripts/full-backup.sh >> /var/log/cloudgpus-backup.log 2>&1
```

### Volume Backup (Duplicati)

Configure in existing Duplicati (`duplicati.expertbeacon.com`):

| Setting     | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Source      | `/opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io/data/` |
| Destination | Cloudflare R2 or B2                                               |
| Schedule    | Daily at 4 AM                                                     |
| Retention   | 7 daily, 4 weekly, 12 monthly                                     |

### Disaster Recovery

1. **Database Recovery:**

   ```bash
   # Find latest backup
   ls -lt backups/*.sql.gz | head -1

   # Restore
   gunzip -c backups/cloudgpus_YYYYMMDD_HHMMSS.sql.gz | \
     docker exec -i supabase-db psql -U postgres
   ```

2. **Full Recovery:**

   ```bash
   # 1. Restore database
   make db-restore

   # 2. Restore volumes from Duplicati
   # (via Duplicati UI)

   # 3. Redeploy
   make deploy
   ```

---

## 8. Security Hardening

### Container Security

```yaml
# Add to each service in docker-compose.yml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /var/tmp
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE # Only for API if needed
```

### Network Isolation

```
External Access:
  nginx-proxy -> api (port 3000)

Internal Only:
  api -> supabase-db (port 5432)
  api -> redis (port 6379)
  workers -> supabase-db (port 5432)
  workers -> redis (port 6379)

No External Access:
  workers (no exposed ports)
  internal network (bridge, internal: true)
```

### Secret Rotation Schedule

| Secret            | Rotation Period | Method                       |
| ----------------- | --------------- | ---------------------------- |
| `PAYLOAD_SECRET`  | 90 days         | Regenerate, redeploy         |
| `DB_PASSWORD`     | 180 days        | Update Supabase, update .env |
| Provider API Keys | On compromise   | Update in .env               |
| SSH Keys          | Annually        | Rotate via authorized_keys   |

### Security Checklist

- [ ] `.env` not in git
- [ ] No `:latest` tags in production
- [ ] All containers run as non-root
- [ ] Network isolation configured
- [ ] Health checks enabled
- [ ] Resource limits set
- [ ] Logging configured
- [ ] Secrets in environment, not files
- [ ] CORS properly configured
- [ ] Rate limiting enabled (nginx)

---

## Quick Start

```bash
# 1. Clone repository (on server)
cd /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io

# 2. Create environment file
cp .env.example .env
nano .env  # Fill in secrets

# 3. Initialize database schema
docker exec -i supabase-db psql -U postgres << 'EOF'
CREATE SCHEMA IF NOT EXISTS cloudgpus;
GRANT USAGE ON SCHEMA cloudgpus TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cloudgpus TO postgres, anon, authenticated, service_role;
EOF

# 4. Deploy
make deploy

# 5. Verify
make health
make logs
```

---

## Troubleshooting

| Issue                      | Solution                                  |
| -------------------------- | ----------------------------------------- |
| Container won't start      | `docker compose logs <service>`           |
| Database connection failed | Check `supabase_default` network          |
| Redis connection failed    | Check `redis_default` network             |
| 502 Bad Gateway            | Check API health, nginx logs              |
| Worker not processing      | Check Redis connection, queue names       |
| Out of memory              | Increase `deploy.resources.limits.memory` |

## Support

- Logs: `https://logs.expertbeacon.com` (filter: cloudgpus-\*)
- Uptime: `https://uptime.expertbeacon.com`
- Database: `https://studio.expertbeacon.com` (schema: cloudgpus)
