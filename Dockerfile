# ===========================================
# CloudGPUs.io Dockerfile (Multi-stage)
# ===========================================

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

# Build server only (skip CMS admin due to PayloadCMS/Next.js 15 incompatibility)
# The API will work, admin UI will be unavailable until PayloadCMS fixes the issue
RUN corepack enable pnpm && pnpm build:server

# ===========================================
# Production Stage (API)
# ===========================================
FROM node:20-alpine AS production
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 payload

# Copy built assets (API only, no CMS admin)
COPY --from=builder --chown=payload:nodejs /app/dist ./dist
COPY --from=builder --chown=payload:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=payload:nodejs /app/package.json ./
COPY --from=builder --chown=payload:nodejs /app/migrations ./migrations

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
