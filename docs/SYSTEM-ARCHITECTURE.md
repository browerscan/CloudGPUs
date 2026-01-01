# CloudGPUs.io System Architecture Document

**Version:** 2.0.0
**Date:** 2025-12-30
**Status:** Production-Ready Architecture Design
**Author:** Architecture Agent

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Topology](#2-system-topology)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [API Design](#4-api-design)
5. [Worker System Architecture](#5-worker-system-architecture)
6. [Database Architecture Review](#6-database-architecture-review)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Integration Design](#8-integration-design)
9. [Caching Strategy](#9-caching-strategy)
10. [Scalability and Performance](#10-scalability-and-performance)
11. [Security Architecture](#11-security-architecture)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Monitoring and Observability](#13-monitoring-and-observability)
14. [Technical Decisions](#14-technical-decisions)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

### 1.1 Project Overview

CloudGPUs.io is a GPU cloud pricing aggregation platform targeting 40+ providers with 3000+ programmatic SEO pages. The system aggregates real-time pricing data from specialized AI clouds, regional providers, marketplaces, and DePIN platforms.

### 1.2 Architecture Goals

| Goal             | Target      | Measurement                         |
| ---------------- | ----------- | ----------------------------------- |
| Data Freshness   | < 24 hours  | 95% of prices updated within window |
| Page Load Time   | < 2 seconds | Core Web Vitals LCP                 |
| System Uptime    | 99.5%       | Monthly availability                |
| Scraping Success | > 95%       | Per provider per cycle              |
| API Response     | < 100ms     | P95 latency                         |

### 1.3 Key Components

```
+-------------------+     +-------------------+     +-------------------+
|  Cloudflare Pages |     |    PayloadCMS     |     |    PostgreSQL     |
|  (Next.js 14)     |<--->|  (Headless API)   |<--->|    (Supabase)     |
|  cloudgpus.io     |     |  api.cloudgpus.io |     |  schema:cloudgpus |
+-------------------+     +-------------------+     +-------------------+
                                   ^
                                   |
                          +--------+--------+
                          |                 |
                   +------v------+   +------v------+
                   |    Redis    |   |   BullMQ    |
                   |   (Cache)   |   |  (Workers)  |
                   +-------------+   +-------------+
                                           |
                   +-----------------------+-----------------------+
                   |           |           |           |           |
            +------v--+ +------v--+ +------v--+ +------v--+ +------v--+
            | Pricing | |   API   | | Notify  | | Default | | Browser |
            | Worker  | | Worker  | | Worker  | | Worker  | | Worker  |
            +---------+ +---------+ +---------+ +---------+ +---------+
```

---

## 2. System Topology

### 2.1 High-Level Architecture Diagram

```
                                    INTERNET
                                        |
           +----------------------------+----------------------------+
           |                                                         |
           v                                                         v
+------------------------+                              +------------------------+
|    CLOUDFLARE EDGE     |                              |    CLOUDFLARE PAGES    |
|  (CDN + WAF + DDoS)    |                              |  (Next.js Frontend)    |
|  cloudgpus.io          |                              |  SSG + ISR             |
+------------------------+                              +------------------------+
           |                                                         |
           | HTTPS                                                   | API Calls
           v                                                         v
+--------------------------------------------------------------------------+
|                        107.174.42.198 (VPS Host)                         |
|  +--------------------------------------------------------------------+  |
|  |                      nginx-proxy_default                           |  |
|  |  +--------------------------------------------------------------+  |  |
|  |  |                    PayloadCMS API                            |  |  |
|  |  |                  api.cloudgpus.io:3000                       |  |  |
|  |  |  +-------------+  +-------------+  +-------------+           |  |  |
|  |  |  | Collections |  |  REST API   |  |   Admin UI  |           |  |  |
|  |  |  |  - providers|  |  /api/*     |  |   /admin    |           |  |  |
|  |  |  |  - gpu_models|  |             |  |             |           |  |  |
|  |  |  |  - instances|  |             |  |             |           |  |  |
|  |  |  +-------------+  +-------------+  +-------------+           |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  +--------------------------------------------------------------------+  |
|                                    |                                     |
|            +----------------------++-----------------------+             |
|            |                       |                       |             |
|            v                       v                       v             |
|  +-----------------+    +------------------+    +------------------+     |
|  |  supabase_default|    |   redis_default |    | internal network |     |
|  |  PostgreSQL:5432 |    |    Redis:6379   |    |    (workers)     |     |
|  |  schema:cloudgpus|    |  BullMQ Queues  |    |                  |     |
|  +-----------------+    +------------------+    +------------------+     |
|                                                          |               |
|   +------------------------------------------------------+               |
|   |                                                                      |
|   v                                                                      |
|  +--------------------------------------------------------------------+  |
|  |                        BullMQ Workers                              |  |
|  |  +----------+  +----------+  +----------+  +----------+  +-------+ |  |
|  |  | pricing  |  |   api    |  |  notify  |  | default  |  |browser| |  |
|  |  | worker   |  |  worker  |  |  worker  |  |  worker  |  |worker | |  |
|  |  | (5 conc) |  | (3 conc) |  | (10 conc)|  | (5 conc) |  |(2 con)| |  |
|  |  +----------+  +----------+  +----------+  +----------+  +-------+ |  |
|  +--------------------------------------------------------------------+  |
|                                    |                                     |
+------------------------------------+-------------------------------------+
                                     |
                                     v (SOAX Proxy)
+--------------------------------------------------------------------------+
|                        External Provider APIs                             |
|  +--------+  +--------+  +--------+  +--------+  +--------+  +--------+  |
|  | Lambda |  | RunPod |  |Vast.ai |  | Nebius |  |  GMI   |  | Voltage|  |
|  | REST   |  |GraphQL |  |Browser |  | gRPC   |  |  REST  |  | REST   |  |
|  +--------+  +--------+  +--------+  +--------+  +--------+  +--------+  |
+--------------------------------------------------------------------------+
```

### 2.2 Network Architecture

| Network               | Type              | Services       | Purpose                            |
| --------------------- | ----------------- | -------------- | ---------------------------------- |
| `nginx-proxy_default` | External          | PayloadCMS API | Public HTTPS access                |
| `supabase_default`    | External          | PostgreSQL     | Database access                    |
| `redis_default`       | External          | Redis          | Queue and cache                    |
| `internal`            | Bridge (Internal) | All workers    | Secure inter-service communication |

### 2.3 Service Inventory

| Service        | Container                | Memory | CPU | Port | Network                          |
| -------------- | ------------------------ | ------ | --- | ---- | -------------------------------- |
| PayloadCMS API | cloudgpus-api            | 2GB    | 2.0 | 3000 | proxy, supabase, redis, internal |
| Pricing Worker | cloudgpus-worker-pricing | 768MB  | 1.5 | -    | supabase, redis, internal        |
| API Worker     | cloudgpus-worker-api     | 512MB  | 1.0 | -    | supabase, redis, internal        |
| Notify Worker  | cloudgpus-worker-notify  | 256MB  | 0.5 | -    | redis, internal                  |
| Default Worker | cloudgpus-worker-default | 512MB  | 1.0 | -    | supabase, redis, internal        |
| Browser Worker | cloudgpus-worker-browser | 4GB    | 2.0 | -    | redis, internal                  |

---

## 3. Data Flow Architecture

### 3.1 Complete Data Flow Diagram

```
+============================================================================+
|                           DATA FLOW ARCHITECTURE                           |
+============================================================================+

PHASE 1: SCHEDULING
-------------------
                    +-------------------+
                    |   Cron Scheduler  |
                    |  (Per Provider)   |
                    +--------+----------+
                             |
                             | Staggered (Every 4-6 hours)
                             v
                    +-------------------+
                    | Check Circuit     |
                    | Breaker State     |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
         OPEN |                             | CLOSED
              v                             v
    +----------------+            +-------------------+
    | Skip + Log     |            | Dispatch to Queue |
    | Alert if >24h  |            | scrape:{provider} |
    +----------------+            +--------+----------+
                                           |
PHASE 2: SCRAPING                          |
-----------------                          v
                    +-------------------+
                    |  Adapter Registry |
                    |  (40+ Providers)  |
                    +--------+----------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
    +-----------+      +-----------+      +-----------+
    |  API      |      |  Browser  |      |  Hybrid   |
    |  Adapter  |      |  Adapter  |      |  Adapter  |
    | (Lambda,  |      | (Vast.ai, |      | (Fallback)|
    |  RunPod)  |      |  Salad)   |      |           |
    +-----------+      +-----------+      +-----------+
          |                  |                  |
          +------------------+------------------+
                             |
                             v
                    +-------------------+
                    |   Raw Data        |
                    |   {provider, ts,  |
                    |    raw[], success}|
                    +--------+----------+
                             |
PHASE 3: VALIDATION          |
-------------------          v
                    +-------------------+
                    |  Validation Queue |
                    |  validate:prices  |
                    +--------+----------+
                             |
                             v
          +------------------------------------------+
          |            VALIDATION PIPELINE           |
          |  1. Schema Validation (Zod)              |
          |  2. Business Rules (price > 0, < $100)   |
          |  3. Anomaly Detection (>50% = flag)      |
          |  4. GPU Model Normalization              |
          |  5. Currency Conversion (to USD)         |
          +------------------+-----------------------+
                             |
                        PASS |         FAIL
                             v            v
                    +---------------+  +---------------+
                    | Store Queue   |  | Dead Letter   |
                    | store:prices  |  | Queue + Alert |
                    +-------+-------+  +---------------+
                            |
PHASE 4: STORAGE            |
----------------            v
                    +-------------------+
                    |   PayloadCMS      |
                    |   Upsert Logic    |
                    +--------+----------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
    +-----------+      +-----------+      +-----------+
    | instances |      | price_    |      | scrape_   |
    | table     |      | history   |      | jobs      |
    | (UPSERT)  |      | (INSERT)  |      | (INSERT)  |
    +-----------+      +-----------+      +-----------+
                             |
PHASE 5: INVALIDATION        |
---------------------        v
                    +-------------------+
                    |  Cache Invalidate |
                    +--------+----------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
    +-----------+      +-----------+      +-----------+
    | Redis DEL |      | ISR       |      | CDN Purge |
    | prices:*  |      | Webhook   |      | (Optional)|
    +-----------+      +-----------+      +-----------+
                             |
                             v
                    +-------------------+
                    |  Frontend Pages   |
                    |  Regenerated      |
                    +-------------------+
```

### 3.2 Data Transformation Pipeline

```typescript
// Transformation stages
interface DataPipeline {
  // Stage 1: Raw scrape result
  raw: {
    provider: string;
    timestamp: Date;
    data: unknown;
    responseTime: number;
  };

  // Stage 2: Parsed data
  parsed: {
    instances: RawInstance[];
    metadata: ProviderMetadata;
  };

  // Stage 3: Validated data
  validated: {
    instances: ValidatedInstance[];
    anomalies: Anomaly[];
  };

  // Stage 4: Normalized data
  normalized: NormalizedPrice[];

  // Stage 5: Stored data
  stored: {
    upserted: number;
    created: number;
    unchanged: number;
    snapshots: number;
  };
}
```

### 3.3 Data Freshness SLA

| Provider Tier    | Scrape Frequency | Max Staleness | Alert Threshold |
| ---------------- | ---------------- | ------------- | --------------- |
| Enterprise (P0)  | Every 4 hours    | 6 hours       | 8 hours         |
| Regional (P1)    | Every 6 hours    | 8 hours       | 12 hours        |
| Marketplace (P1) | Every 6 hours    | 8 hours       | 12 hours        |
| DePIN (P2)       | Every 8 hours    | 12 hours      | 24 hours        |

---

## 4. API Design

### 4.1 PayloadCMS REST API Endpoints

#### Core Endpoints

| Endpoint                | Method | Description                     | Cache TTL |
| ----------------------- | ------ | ------------------------------- | --------- |
| `/api/providers`        | GET    | List all providers              | 5 min     |
| `/api/providers/:slug`  | GET    | Get provider details            | 5 min     |
| `/api/gpu-models`       | GET    | List all GPU models             | 1 hour    |
| `/api/gpu-models/:slug` | GET    | Get GPU model details           | 1 hour    |
| `/api/instances`        | GET    | List GPU instances with pricing | 1 min     |
| `/api/health`           | GET    | Health check                    | No cache  |

#### Query Parameters for `/api/instances`

```typescript
interface InstancesQuery {
  // Filtering
  "where[provider_id][equals]"?: string;
  "where[gpu_model_id][equals]"?: string;
  "where[availability_status][equals]"?: "available" | "limited" | "waitlist";
  "where[price_per_gpu_hour][less_than]"?: number;
  "where[is_active][equals]"?: boolean;

  // Sorting
  sort?: "price_per_gpu_hour" | "-price_per_gpu_hour" | "last_scraped_at";

  // Pagination
  limit?: number; // Default: 50, Max: 100
  page?: number;

  // Population (joins)
  depth?: number; // 0-2
}
```

#### Response Format

```typescript
interface PaginatedResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}
```

### 4.2 Custom API Endpoints

#### Price Comparison Endpoint

```typescript
// GET /api/compare-prices
// Purpose: Optimized endpoint for price comparison tables

interface CompareRequest {
  gpuSlug: string; // e.g., 'h100-sxm'
  tier?: ReliabilityTier; // Filter by provider tier
  includeSpot?: boolean; // Include spot pricing
  maxPrice?: number; // Price filter
}

interface CompareResponse {
  gpu: GpuModel;
  prices: {
    provider: ProviderSummary;
    onDemand: number | null;
    spot: number | null;
    reserved1y: number | null;
    availability: AvailabilityStatus;
    lastUpdated: string;
    affiliateUrl: string;
  }[];
  stats: {
    min: number;
    max: number;
    median: number;
    providerCount: number;
  };
  generatedAt: string;
}
```

#### Provider Comparison Endpoint

```typescript
// GET /api/compare-providers
// Purpose: Head-to-head provider comparison

interface ProviderCompareRequest {
  providers: [string, string]; // Exactly 2 provider slugs
}

interface ProviderCompareResponse {
  provider1: ProviderWithPrices;
  provider2: ProviderWithPrices;
  commonGpus: GpuComparison[];
  verdict: {
    cheaper: string | "tie";
    moreGpus: string | "tie";
    betterFor: { useCase: string; provider: string }[];
  };
}
```

### 4.3 API Rate Limiting

| Client Type   | Rate Limit | Window | Burst |
| ------------- | ---------- | ------ | ----- |
| Anonymous     | 100 req    | 1 hour | 20    |
| Authenticated | 1000 req   | 1 hour | 100   |
| ISR Webhook   | Unlimited  | -      | -     |

### 4.4 Error Response Format

```typescript
interface ApiError {
  status: number;
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
}

// Example
{
  "status": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "remaining": 0,
    "resetAt": "2025-12-30T12:00:00Z"
  },
  "timestamp": "2025-12-30T11:59:15Z",
  "requestId": "req_abc123"
}
```

---

## 5. Worker System Architecture

### 5.1 Worker Topology

```
+============================================================================+
|                          WORKER SYSTEM TOPOLOGY                            |
+============================================================================+

                          +-------------------+
                          |   Redis Server    |
                          |    (BullMQ)       |
                          +---------+---------+
                                    |
     +------------------------------+------------------------------+
     |              |               |               |              |
     v              v               v               v              v
+----------+  +----------+   +----------+   +----------+   +----------+
|  Queue:  |  |  Queue:  |   |  Queue:  |   |  Queue:  |   |  Queue:  |
| pricing- |  | api-sync |   |  email   |   | default  |   | browser- |
|   fetch  |  | provider-|   | webhook  |   |  maint   |   |  scrape  |
| pricing- |  |  update  |   |  slack   |   | cleanup  |   |screenshot|
|aggregate |  |          |   |          |   |          |   |          |
+----+-----+  +----+-----+   +----+-----+   +----+-----+   +----+-----+
     |             |              |              |              |
     v             v              v              v              v
+----------+  +----------+   +----------+   +----------+   +----------+
| PRICING  |  |   API    |   | NOTIFY   |   | DEFAULT  |   | BROWSER  |
| WORKER   |  |  WORKER  |   | WORKER   |   | WORKER   |   | WORKER   |
|          |  |          |   |          |   |          |   |          |
| Conc: 5  |  | Conc: 3  |   | Conc: 10 |   | Conc: 5  |   | Conc: 2  |
| Mem: 768M|  | Mem: 512M|   | Mem: 256M|   | Mem: 512M|   | Mem: 4GB |
+----------+  +----------+   +----------+   +----------+   +----------+
```

### 5.2 Worker Responsibilities

#### 5.2.1 Pricing Worker

```typescript
// Queues: pricing-fetch, pricing-aggregate
// Purpose: Fetch GPU pricing from provider APIs

interface PricingWorkerConfig {
  queues: ["pricing-fetch", "pricing-aggregate"];
  concurrency: 5;
  limiter: { max: 10; duration: 1000 }; // 10 jobs per second
}

// Job Types
interface PricingFetchJob {
  name: "fetch-provider";
  data: {
    providerId: string;
    providerSlug: string;
    adapterType: "api" | "browser" | "hybrid";
    priority: "P0" | "P1" | "P2";
  };
  opts: {
    attempts: 3;
    backoff: { type: "exponential"; delay: 1000 };
    timeout: 60000;
  };
}

interface PricingAggregateJob {
  name: "aggregate-stats";
  data: {
    gpuModelId: string;
    computeStats: boolean;
  };
}

// Provider API Keys Environment
const PROVIDER_KEYS = {
  LAMBDA_API_KEY: process.env.LAMBDA_API_KEY,
  RUNPOD_API_KEY: process.env.RUNPOD_API_KEY,
  VASTAI_API_KEY: process.env.VASTAI_API_KEY,
  COREWEAVE_API_KEY: process.env.COREWEAVE_API_KEY,
  NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
  GMI_API_KEY: process.env.GMI_API_KEY,
  VOLTAGEPARK_API_KEY: process.env.VOLTAGEPARK_API_KEY,
  IONET_API_KEY: process.env.IONET_API_KEY,
};
```

#### 5.2.2 API Worker

```typescript
// Queues: api-sync, provider-update
// Purpose: Sync provider metadata and handle API-based operations

interface ApiWorkerConfig {
  queues: ["api-sync", "provider-update"];
  concurrency: 3;
}

// Job Types
interface ApiSyncJob {
  name: "sync-provider-metadata";
  data: {
    providerId: string;
    syncFields: ("regions" | "features" | "status")[];
  };
}

interface ProviderUpdateJob {
  name: "update-provider-status";
  data: {
    providerId: string;
    newStatus: "active" | "degraded" | "disabled";
    reason: string;
  };
}
```

#### 5.2.3 Notify Worker

```typescript
// Queues: email, webhook, slack
// Purpose: Send notifications and alerts

interface NotifyWorkerConfig {
  queues: ["email", "webhook", "slack"];
  concurrency: 10;
}

// Job Types
interface EmailJob {
  name: "send-email";
  data: {
    template: "price-alert" | "scrape-failure" | "weekly-report";
    to: string;
    subject: string;
    variables: Record<string, unknown>;
  };
}

interface SlackJob {
  name: "send-slack";
  data: {
    channel: "alerts" | "monitoring";
    message: string;
    blocks?: unknown[];
  };
}

interface WebhookJob {
  name: "trigger-webhook";
  data: {
    url: string;
    method: "POST" | "GET";
    payload: unknown;
    headers?: Record<string, string>;
  };
}
```

#### 5.2.4 Default Worker

```typescript
// Queues: default, maintenance, cleanup
// Purpose: Miscellaneous tasks and maintenance

interface DefaultWorkerConfig {
  queues: ["default", "maintenance", "cleanup"];
  concurrency: 5;
}

// Job Types
interface MaintenanceJob {
  name: "cleanup-stale-instances";
  data: {
    olderThan: string; // ISO duration: 'P1D' (1 day)
  };
}

interface CleanupJob {
  name: "purge-old-history";
  data: {
    retentionDays: number; // Default: 90
  };
}
```

#### 5.2.5 Browser Worker

```typescript
// Queues: browser-scrape, screenshot
// Purpose: Playwright-based scraping for anti-bot protected sites

interface BrowserWorkerConfig {
  queues: ["browser-scrape", "screenshot"];
  concurrency: 2; // Memory-limited
  shm_size: "2gb";
}

// Job Types
interface BrowserScrapeJob {
  name: "scrape-with-browser";
  data: {
    providerId: string;
    targetUrl: string;
    waitForSelector: string;
    extractionScript: string; // JS code to run in page context
    proxyRequired: boolean;
  };
  opts: {
    timeout: 120000; // 2 minutes
    attempts: 2;
  };
}

interface ScreenshotJob {
  name: "take-screenshot";
  data: {
    url: string;
    viewport: { width: number; height: number };
    fullPage: boolean;
  };
}

// Playwright Configuration
const browserConfig = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  proxy: process.env.SOAX_PROXY_URL
    ? {
        server: process.env.SOAX_PROXY_URL,
      }
    : undefined,
};
```

### 5.3 Job Scheduling Strategy

```typescript
// Cron-based scheduling for scraping
const SCRAPE_SCHEDULES = {
  // P0 - Enterprise providers (every 4 hours)
  "lambda-labs": "0 0,4,8,12,16,20 * * *",
  coreweave: "0 1,5,9,13,17,21 * * *",
  "voltage-park": "0 2,6,10,14,18,22 * * *",

  // P1 - Regional/Marketplace (every 6 hours)
  runpod: "0 0,6,12,18 * * *",
  nebius: "0 1,7,13,19 * * *",
  "gmi-cloud": "0 2,8,14,20 * * *",
  hyperstack: "0 3,9,15,21 * * *",

  // P2 - DePIN (every 8 hours)
  "vast-ai": "0 0,8,16 * * *",
  "io-net": "0 2,10,18 * * *",
  salad: "0 4,12,20 * * *",
};

// Maintenance schedules
const MAINTENANCE_SCHEDULES = {
  "cleanup-stale": "0 3 * * *", // Daily at 3 AM
  "purge-history": "0 4 * * 0", // Weekly Sunday 4 AM
  "aggregate-stats": "30 * * * *", // Every hour at :30
};
```

### 5.4 Error Handling and Retry Strategy

```typescript
interface RetryStrategy {
  maxAttempts: number;
  backoff: {
    type: "exponential" | "fixed";
    delay: number;
    maxDelay: number;
  };
  retryableErrors: string[];
  fatalErrors: string[];
}

const RETRY_STRATEGIES: Record<string, RetryStrategy> = {
  "pricing-fetch": {
    maxAttempts: 3,
    backoff: { type: "exponential", delay: 1000, maxDelay: 30000 },
    retryableErrors: ["ECONNRESET", "ETIMEDOUT", "429", "503", "502"],
    fatalErrors: ["401", "403", "INVALID_API_KEY"],
  },
  "browser-scrape": {
    maxAttempts: 2,
    backoff: { type: "fixed", delay: 5000, maxDelay: 5000 },
    retryableErrors: ["TIMEOUT", "NAVIGATION_ERROR"],
    fatalErrors: ["BLOCKED", "CAPTCHA_REQUIRED"],
  },
  email: {
    maxAttempts: 5,
    backoff: { type: "exponential", delay: 2000, maxDelay: 60000 },
    retryableErrors: ["SMTP_ERROR", "RATE_LIMITED"],
    fatalErrors: ["INVALID_RECIPIENT"],
  },
};
```

### 5.5 Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  provider: string;
  failureThreshold: number; // Failures before OPEN
  successThreshold: number; // Successes before CLOSED
  timeout: number; // Time in OPEN before HALF-OPEN (ms)
  halfOpenMaxCalls: number; // Max calls in HALF-OPEN
}

const CIRCUIT_CONFIGS: Record<string, Partial<CircuitBreakerConfig>> = {
  // Strict for enterprise providers
  "lambda-labs": { failureThreshold: 3, timeout: 300000 }, // 5 min
  coreweave: { failureThreshold: 3, timeout: 300000 },

  // Lenient for DePIN (more variable)
  "vast-ai": { failureThreshold: 5, timeout: 600000 }, // 10 min
  salad: { failureThreshold: 5, timeout: 600000 },

  // Default
  default: { failureThreshold: 5, successThreshold: 3, timeout: 60000 },
};
```

### 5.6 Worker Monitoring

```typescript
// Health check endpoint for workers
interface WorkerHealthCheck {
  worker: string;
  status: "healthy" | "unhealthy" | "degraded";
  queues: {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }[];
  uptime: number;
  memory: NodeJS.MemoryUsage;
  lastJobAt: string | null;
}

// Metrics to track
const WORKER_METRICS = [
  "jobs_processed_total",
  "jobs_failed_total",
  "job_duration_seconds",
  "queue_depth",
  "circuit_breaker_state",
];
```

---

## 6. Database Architecture Review

### 6.1 Schema Overview

The database schema is well-designed in `DATABASE.md`. Key validations:

#### 6.1.1 Table Analysis

| Table            | Purpose           | Write Freq  | Read Freq | Growth Rate |
| ---------------- | ----------------- | ----------- | --------- | ----------- |
| `gpu_models`     | GPU catalog       | Low (admin) | Very High | ~10/year    |
| `providers`      | Provider registry | Low (admin) | Very High | ~5/year     |
| `instances`      | Current prices    | Very High   | Very High | ~2K rows    |
| `price_history`  | Historical data   | Very High   | Medium    | ~15K/month  |
| `scrape_jobs`    | Job logs          | High        | Low       | ~7K/month   |
| `gpu_benchmarks` | Performance data  | Very Low    | Medium    | ~100/year   |
| `content_pages`  | pSEO content      | Low         | High      | ~3K total   |

#### 6.1.2 Index Recommendations (Already Implemented)

The existing indexes are comprehensive. Additional considerations:

```sql
-- Consider adding for common query patterns:

-- 1. Multi-GPU configuration queries
CREATE INDEX IF NOT EXISTS idx_instances_gpu_count_price
ON cloudgpus.instances(gpu_count, price_per_gpu_hour)
WHERE is_active = true AND gpu_count > 1;

-- 2. Spot price queries
CREATE INDEX IF NOT EXISTS idx_instances_spot_price
ON cloudgpus.instances(price_per_hour_spot)
WHERE is_active = true AND price_per_hour_spot IS NOT NULL;

-- 3. Content pages by GPU
CREATE INDEX IF NOT EXISTS idx_content_pages_gpu_ids
ON cloudgpus.content_pages USING GIN(related_gpu_ids);
```

### 6.2 Partitioning Strategy for price_history

Implement when table exceeds 10M rows (approximately 18 months):

```sql
-- Monthly partitioning for price_history
-- Current: ~15,000 rows/month
-- Trigger at: 10M rows (~18 months)

-- Step 1: Create partitioned table
CREATE TABLE IF NOT EXISTS cloudgpus.price_history_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL,
    provider_id UUID NOT NULL,
    gpu_model_id UUID NOT NULL,
    price_per_hour NUMERIC(10,4) NOT NULL,
    price_per_gpu_hour NUMERIC(10,4) NOT NULL,
    price_per_hour_spot NUMERIC(10,4),
    availability_status cloudgpus.availability_status NOT NULL,
    gpu_count SMALLINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Step 2: Create partitions dynamically
-- Auto-create via pg_partman or scheduled job
```

### 6.3 Data Retention Policy

| Data Type          | Retention | Cleanup Schedule     |
| ------------------ | --------- | -------------------- |
| `price_history`    | 90 days   | Weekly (Sunday 4 AM) |
| `scrape_jobs`      | 30 days   | Weekly (Sunday 5 AM) |
| Inactive instances | 7 days    | Daily (3 AM)         |
| API logs           | 14 days   | Weekly               |

```sql
-- Cleanup function (already exists, verify schedule)
SELECT cloudgpus.cleanup_stale_instances();

-- Additional cleanup for old history
DELETE FROM cloudgpus.price_history
WHERE recorded_at < NOW() - INTERVAL '90 days';

-- Cleanup old scrape jobs
DELETE FROM cloudgpus.scrape_jobs
WHERE started_at < NOW() - INTERVAL '30 days';
```

### 6.4 Backup Strategy

| Backup Type   | Frequency            | Retention | Storage          |
| ------------- | -------------------- | --------- | ---------------- |
| Full schema   | Weekly (Sunday 2 AM) | 12 weeks  | R2 + Local       |
| Incremental   | Daily (3 AM)         | 30 days   | Local            |
| WAL archiving | Continuous           | 7 days    | Supabase managed |

---

## 7. Frontend Architecture

### 7.1 Next.js Project Structure

```
frontend/
├── app/                          # App Router
│   ├── (marketing)/              # Marketing pages group
│   │   ├── page.tsx              # Homepage
│   │   ├── about/
│   │   └── pricing/
│   │
│   ├── cloud-gpu/                # GPU pages (pSEO)
│   │   ├── page.tsx              # GPU hub /cloud-gpu
│   │   └── [slug]/
│   │       ├── page.tsx          # /cloud-gpu/h100
│   │       └── loading.tsx
│   │
│   ├── provider/                 # Provider pages (pSEO)
│   │   ├── page.tsx              # Provider hub /provider
│   │   └── [slug]/
│   │       ├── page.tsx          # /provider/lambda-labs
│   │       └── loading.tsx
│   │
│   ├── compare/                  # Comparison pages (pSEO)
│   │   └── [comparison]/
│   │       └── page.tsx          # /compare/lambda-vs-runpod
│   │
│   ├── best-gpu-for/             # Use case pages (pSEO)
│   │   └── [use-case]/
│   │       └── page.tsx          # /best-gpu-for/llm-training
│   │
│   ├── calculator/               # Interactive tools
│   │   ├── cost-estimator/
│   │   └── gpu-selector/
│   │
│   ├── api/                      # API routes
│   │   ├── revalidate/           # ISR webhook
│   │   └── affiliate/            # Click tracking
│   │
│   ├── layout.tsx                # Root layout
│   ├── not-found.tsx
│   ├── error.tsx
│   └── sitemap.ts                # Dynamic sitemap
│
├── components/
│   ├── ui/                       # Shadcn/UI components
│   ├── price-table/
│   ├── provider-card/
│   ├── gpu-specs/
│   ├── comparison-grid/
│   └── charts/
│
├── lib/
│   ├── api.ts                    # API client
│   ├── cache.ts                  # Caching utilities
│   ├── schemas.ts                # Zod schemas
│   └── utils.ts
│
├── types/
│   └── index.ts                  # TypeScript types
│
└── public/
    ├── images/
    │   ├── gpus/
    │   └── providers/
    └── robots.txt
```

### 7.2 ISR (Incremental Static Regeneration) Strategy

| Page Type        | Revalidate        | Static Params        | Notes           |
| ---------------- | ----------------- | -------------------- | --------------- |
| Homepage         | 300s (5 min)      | N/A                  | Featured prices |
| GPU Pages        | 600s (10 min)     | generateStaticParams | Price changes   |
| Provider Pages   | 3600s (1 hour)    | generateStaticParams | Metadata stable |
| Comparison Pages | 1800s (30 min)    | generateStaticParams | Derived data    |
| Use Case Pages   | 86400s (24 hours) | generateStaticParams | Editorial       |
| Calculator       | On-demand         | N/A                  | Client-side     |

```typescript
// app/cloud-gpu/[slug]/page.tsx
export const revalidate = 600; // 10 minutes

export async function generateStaticParams() {
  const gpus = await fetchGpuModels();
  return gpus.map((gpu) => ({ slug: gpu.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const gpu = await fetchGpu(params.slug);
  const prices = await fetchPrices(params.slug);

  return {
    title: `${gpu.name} Cloud Pricing 2025 | Compare ${prices.length}+ Providers`,
    description: `Compare ${gpu.name} GPU cloud pricing from ${prices.length} providers. Prices from $${prices.minPrice} to $${prices.maxPrice}/hr.`,
    // ... other metadata
  };
}
```

### 7.3 API Integration Pattern

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.cloudgpus.io";

interface FetchOptions {
  revalidate?: number;
  tags?: string[];
}

export async function fetchFromAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate = 60, tags = [] } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    next: {
      revalidate,
      tags,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// Usage
export async function fetchGpuPrices(gpuSlug: string) {
  return fetchFromAPI<PaginatedResponse<Instance>>(
    `/api/instances?where[gpu_model_id][equals]=${gpuSlug}&sort=price_per_gpu_hour`,
    { revalidate: 600, tags: [`prices-${gpuSlug}`] },
  );
}
```

### 7.4 Static Generation Targets

| Page Category                     | Count            | Generation Method    |
| --------------------------------- | ---------------- | -------------------- |
| GPU Pages                         | 15               | generateStaticParams |
| Provider Pages                    | 40+              | generateStaticParams |
| Comparison (Provider vs Provider) | 100 (top pairs)  | generateStaticParams |
| Comparison (GPU vs GPU)           | 20               | generateStaticParams |
| Use Case Pages                    | 25               | generateStaticParams |
| Region Pages                      | 6                | generateStaticParams |
| **Total**                         | **~200 initial** | -                    |

### 7.5 Performance Budget

```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    minimumCacheTTL: 86400,
  },

  // Bundle analysis
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === "true") {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          reportFilename: isServer ? "../analyze/server.html" : "./analyze/client.html",
        }),
      );
    }
    return config;
  },
};
```

| Metric              | Target  | Maximum |
| ------------------- | ------- | ------- |
| Initial JS          | < 150KB | 200KB   |
| Per-route JS        | < 50KB  | 75KB    |
| CSS                 | < 50KB  | 75KB    |
| Images (above fold) | < 500KB | 750KB   |
| LCP                 | < 2.0s  | 2.5s    |
| CLS                 | < 0.05  | 0.1     |
| FID/INP             | < 100ms | 200ms   |

---

## 8. Integration Design

### 8.1 SOAX API Integration

```typescript
// lib/soax/client.ts
interface SoaxConfig {
  proxyUrl: string;
  username: string;
  password: string;
  country?: string;
  sessionDuration?: number;
}

class SoaxClient {
  private config: SoaxConfig;

  constructor(config: SoaxConfig) {
    this.config = config;
  }

  // Web Scraping API (for REST calls through proxy)
  async fetchThroughProxy(url: string, options?: RequestInit): Promise<Response> {
    const proxyAgent = new HttpsProxyAgent(
      `http://${this.config.username}:${this.config.password}@${this.config.proxyUrl}`,
    );

    return fetch(url, {
      ...options,
      agent: proxyAgent,
      headers: {
        ...options?.headers,
        "User-Agent": this.getRandomUserAgent(),
      },
    });
  }

  // SERP API (for structured search results)
  async serpSearch(query: string, location?: string): Promise<SerpResult> {
    // Use for competitive analysis or price verification
    const response = await fetch("https://api.soax.com/v1/serp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SOAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        location: location || "United States",
        engine: "google",
      }),
    });

    return response.json();
  }

  // Get proxy for Playwright
  getPlaywrightProxy(): PlaywrightProxy {
    return {
      server: `http://${this.config.proxyUrl}`,
      username: this.config.username,
      password: this.config.password,
    };
  }

  private getRandomUserAgent(): string {
    const agents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
      // ... more agents
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
}
```

### 8.2 Provider Adapter Registry

```typescript
// lib/adapters/registry.ts
import { LambdaAdapter } from "./providers/lambda";
import { RunPodAdapter } from "./providers/runpod";
import { VastAiAdapter } from "./providers/vastai";
// ... more imports

export const adapterRegistry = new Map<string, typeof BaseAdapter>([
  // P0 - Enterprise (API-based)
  ["lambda-labs", LambdaAdapter],
  ["coreweave", CoreWeaveAdapter],
  ["voltage-park", VoltageParkAdapter],

  // P1 - Regional (API-based)
  ["nebius", NebiusAdapter],
  ["gmi-cloud", GmiCloudAdapter],
  ["hyperstack", HyperstackAdapter],
  ["scaleway", ScalewayAdapter],

  // P1 - Marketplace (Mixed)
  ["runpod", RunPodAdapter], // GraphQL
  ["tensordock", TensorDockAdapter], // REST

  // P2 - DePIN (Browser-based)
  ["vast-ai", VastAiAdapter], // Browser
  ["io-net", IoNetAdapter], // REST
  ["salad", SaladAdapter], // REST
]);

// Adapter type mapping
export const ADAPTER_TYPES: Record<string, "api" | "browser" | "hybrid"> = {
  "lambda-labs": "api",
  runpod: "api",
  "vast-ai": "browser",
  salad: "api",
  // ... all providers
};
```

### 8.3 PayloadCMS Integration

```typescript
// lib/payload/client.ts
import { getPayload } from "payload";
import config from "../../payload.config";

let cachedPayload: Awaited<ReturnType<typeof getPayload>> | null = null;

export async function getPayloadClient() {
  if (cachedPayload) return cachedPayload;

  cachedPayload = await getPayload({ config });
  return cachedPayload;
}

// Usage in workers
export async function upsertInstance(data: NormalizedPrice) {
  const payload = await getPayloadClient();

  // Find existing
  const existing = await payload.find({
    collection: "instances",
    where: {
      provider: { equals: data.providerId },
      instance_type: { equals: data.instanceType },
    },
    limit: 1,
  });

  if (existing.docs.length > 0) {
    // Update
    return payload.update({
      collection: "instances",
      id: existing.docs[0].id,
      data: {
        price_per_hour: data.pricePerHour,
        availability_status: data.availability,
        last_scraped_at: new Date().toISOString(),
      },
    });
  } else {
    // Create
    return payload.create({
      collection: "instances",
      data: {
        provider: data.providerId,
        gpu_model: data.gpuModelId,
        instance_type: data.instanceType,
        price_per_hour: data.pricePerHour,
        gpu_count: data.gpuCount,
        availability_status: data.availability,
      },
    });
  }
}
```

### 8.4 BullMQ Integration

```typescript
// lib/queue/index.ts
import { Queue, Worker, QueueScheduler } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL);

// Queue definitions
export const queues = {
  pricingFetch: new Queue("pricing-fetch", { connection }),
  pricingAggregate: new Queue("pricing-aggregate", { connection }),
  apiSync: new Queue("api-sync", { connection }),
  providerUpdate: new Queue("provider-update", { connection }),
  email: new Queue("email", { connection }),
  webhook: new Queue("webhook", { connection }),
  slack: new Queue("slack", { connection }),
  browserScrape: new Queue("browser-scrape", { connection }),
  screenshot: new Queue("screenshot", { connection }),
  default: new Queue("default", { connection }),
  maintenance: new Queue("maintenance", { connection }),
  cleanup: new Queue("cleanup", { connection }),
};

// Schedule repeatable jobs
export async function setupScheduledJobs() {
  const { pricingFetch, maintenance, cleanup } = queues;

  // Pricing scrapes - staggered by provider
  for (const [provider, schedule] of Object.entries(SCRAPE_SCHEDULES)) {
    await pricingFetch.add(
      "scheduled-scrape",
      { providerSlug: provider },
      {
        repeat: { pattern: schedule },
        jobId: `scrape-${provider}`,
      },
    );
  }

  // Daily cleanup
  await maintenance.add(
    "cleanup-stale",
    { olderThan: "P1D" },
    { repeat: { pattern: "0 3 * * *" }, jobId: "cleanup-stale" },
  );

  // Weekly history purge
  await cleanup.add(
    "purge-history",
    { retentionDays: 90 },
    { repeat: { pattern: "0 4 * * 0" }, jobId: "purge-history" },
  );
}
```

---

## 9. Caching Strategy

### 9.1 Multi-Layer Cache Architecture

```
+============================================================================+
|                          CACHING ARCHITECTURE                              |
+============================================================================+

                              REQUEST FLOW
                                   |
                                   v
+-------------------+    MISS    +-------------------+
|   Cloudflare      |----------->|   Next.js ISR    |
|   Edge Cache      |            |   (Page Cache)    |
|   TTL: 60s        |<-----------+   TTL: 300-3600s  |
+-------------------+    HIT     +-------------------+
                                         |
                                    MISS |
                                         v
                              +-------------------+
                              |   Redis Cache     |
                              |   (API Responses) |
                              |   TTL: 60-300s    |
                              +---------+---------+
                                        |
                                   MISS |
                                        v
                              +-------------------+
                              |   PostgreSQL      |
                              |   (Source)        |
                              +-------------------+
```

### 9.2 Redis Cache Configuration

```typescript
// lib/cache/redis.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

interface CacheConfig {
  ttl: number; // Seconds
  staleWhileRevalidate?: number;
  tags?: string[];
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // API responses
  "prices:gpu:*": { ttl: 60, staleWhileRevalidate: 120 },
  "prices:provider:*": { ttl: 60, staleWhileRevalidate: 120 },
  "providers:list": { ttl: 300 },
  "providers:*": { ttl: 300 },
  "gpus:list": { ttl: 3600 },
  "gpus:*": { ttl: 3600 },

  // Computed data
  "stats:*": { ttl: 300 },
  "compare:*": { ttl: 180 },

  // Circuit breaker state
  "circuit:*": { ttl: 86400 }, // 24 hours
};

export class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, config?: CacheConfig): Promise<void> {
    const matchedConfig = this.matchConfig(key) || config || { ttl: 60 };
    await redis.setex(key, matchedConfig.ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidate(`*:${tag}:*`);
    }
  }

  private matchConfig(key: string): CacheConfig | undefined {
    for (const [pattern, config] of Object.entries(CACHE_CONFIGS)) {
      if (this.matchPattern(key, pattern)) {
        return config;
      }
    }
    return undefined;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(key);
  }
}
```

### 9.3 Cache Invalidation Strategy

```typescript
// Cache invalidation triggers
interface InvalidationEvent {
  type: "price_update" | "provider_update" | "gpu_update" | "manual";
  target: {
    providerId?: string;
    gpuModelId?: string;
  };
}

async function handleInvalidation(event: InvalidationEvent): Promise<void> {
  const cache = new CacheManager();
  const invalidations: string[] = [];

  switch (event.type) {
    case "price_update":
      // Invalidate price caches
      if (event.target.providerId) {
        invalidations.push(`prices:provider:${event.target.providerId}`);
      }
      if (event.target.gpuModelId) {
        invalidations.push(`prices:gpu:${event.target.gpuModelId}`);
      }
      invalidations.push("stats:*");
      break;

    case "provider_update":
      invalidations.push(`providers:${event.target.providerId}`);
      invalidations.push("providers:list");
      break;

    case "gpu_update":
      invalidations.push(`gpus:${event.target.gpuModelId}`);
      invalidations.push("gpus:list");
      break;
  }

  // Execute invalidations
  await Promise.all(invalidations.map((pattern) => cache.invalidate(pattern)));

  // Trigger ISR revalidation
  await triggerIsrRevalidation(event);
}

async function triggerIsrRevalidation(event: InvalidationEvent): Promise<void> {
  const tags: string[] = [];

  if (event.target.gpuModelId) {
    tags.push(`prices-${event.target.gpuModelId}`);
  }
  if (event.target.providerId) {
    tags.push(`provider-${event.target.providerId}`);
  }

  await fetch(`${process.env.FRONTEND_URL}/api/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.REVALIDATION_SECRET}`,
    },
    body: JSON.stringify({ tags }),
  });
}
```

---

## 10. Scalability and Performance

### 10.1 Current Capacity Analysis

| Metric           | Current | Capacity | Utilization |
| ---------------- | ------- | -------- | ----------- |
| Providers        | 40      | 100+     | 40%         |
| GPU Models       | 15      | 50       | 30%         |
| Price Records    | ~2,000  | 10,000   | 20%         |
| Scrapes/Day      | 240     | 1,000    | 24%         |
| API Requests/Day | ~50,000 | 500,000  | 10%         |
| Database Size    | ~100MB  | 10GB     | 1%          |

### 10.2 Horizontal Scaling Strategy

```
+============================================================================+
|                        SCALING DECISION TREE                               |
+============================================================================+

                          API Response Time
                               > 500ms?
                                  |
                    +-------------+-------------+
                    |                           |
                   YES                          NO
                    |                           |
                    v                           v
          +-------------------+       +-------------------+
          | Scale PayloadCMS  |       | Check Queue Depth |
          | Add LB + Replica  |       |     > 100?        |
          +-------------------+       +--------+----------+
                                               |
                                  +------------+------------+
                                  |                         |
                                 YES                        NO
                                  |                         |
                                  v                         v
                        +-------------------+     +-------------------+
                        | Scale Workers     |     | Check DB Query    |
                        | Add instances     |     | Time > 50ms?      |
                        +-------------------+     +--------+----------+
                                                           |
                                              +------------+------------+
                                              |                         |
                                             YES                        NO
                                              |                         |
                                              v                         v
                                    +-------------------+     +-------------------+
                                    | Add Read Replica  |     | Monitor + Wait    |
                                    | Optimize Indexes  |     |                   |
                                    +-------------------+     +-------------------+
```

### 10.3 Scaling Triggers

| Component      | Metric       | Warning | Critical | Action             |
| -------------- | ------------ | ------- | -------- | ------------------ |
| API            | P95 Response | > 300ms | > 500ms  | Add replica        |
| Workers        | Queue Depth  | > 50    | > 100    | Scale workers      |
| Database       | Query Time   | > 30ms  | > 50ms   | Optimize/replica   |
| Redis          | Memory       | > 500MB | > 1GB    | Dedicated instance |
| Browser Worker | Memory       | > 3GB   | > 3.5GB  | Add instance       |

### 10.4 Database Connection Pool

```typescript
// Connection pool configuration
const poolConfig = {
  // Production settings
  production: {
    min: 5,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  },

  // Worker settings (lower concurrency)
  worker: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
  },
};
```

### 10.5 Performance Baseline

| Operation            | Target P50 | Target P95 | Target P99 |
| -------------------- | ---------- | ---------- | ---------- |
| API: List GPUs       | < 20ms     | < 50ms     | < 100ms    |
| API: List Prices     | < 30ms     | < 75ms     | < 150ms    |
| API: Get Provider    | < 20ms     | < 50ms     | < 100ms    |
| Scrape: API Provider | < 2s       | < 5s       | < 10s      |
| Scrape: Browser      | < 10s      | < 30s      | < 60s      |
| Page Render (ISR)    | < 200ms    | < 500ms    | < 1s       |

---

## 11. Security Architecture

### 11.1 Security Layers

```
+============================================================================+
|                          SECURITY ARCHITECTURE                             |
+============================================================================+

                              INTERNET
                                  |
                                  v
+-------------------------------------------------------------------------+
|                        CLOUDFLARE WAF + DDoS                            |
|  - Bot Protection                                                       |
|  - Rate Limiting (100 req/min anonymous)                               |
|  - Geographic restrictions (optional)                                   |
|  - TLS 1.3                                                             |
+-------------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                        nginx-proxy (TLS Termination)                    |
|  - Let's Encrypt certificates                                          |
|  - HSTS headers                                                        |
|  - Security headers                                                    |
+-------------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                        PayloadCMS API                                   |
|  - JWT authentication (admin)                                          |
|  - CORS whitelist                                                      |
|  - Input validation (Zod)                                              |
|  - SQL injection prevention (ORM)                                      |
+-------------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                        Database (Supabase)                              |
|  - Schema isolation (cloudgpus schema)                                 |
|  - Row-level security (optional)                                       |
|  - Encrypted at rest                                                   |
|  - TLS in transit                                                      |
+-------------------------------------------------------------------------+
```

### 11.2 API Key Management

```typescript
// Environment variable structure
interface EnvironmentSecrets {
  // Core
  PAYLOAD_SECRET: string; // 32+ chars, random
  DB_PASSWORD: string; // From Supabase

  // Provider API Keys (encrypted in .env)
  LAMBDA_API_KEY?: string;
  RUNPOD_API_KEY?: string;
  VASTAI_API_KEY?: string;
  COREWEAVE_API_KEY?: string;
  NEBIUS_API_KEY?: string;
  GMI_API_KEY?: string;
  VOLTAGEPARK_API_KEY?: string;
  IONET_API_KEY?: string;

  // Services
  SOAX_PROXY_URL?: string;
  SMTP_PASS?: string;
  SLACK_WEBHOOK_URL?: string;

  // Cloudflare
  CF_REVALIDATE_SECRET: string;
}

// Secret rotation schedule
const ROTATION_SCHEDULE = {
  PAYLOAD_SECRET: 90, // days
  DB_PASSWORD: 180,
  PROVIDER_KEYS: "on_compromise",
  SSH_KEYS: 365,
};
```

### 11.3 CORS Configuration

```typescript
// PayloadCMS CORS config
const corsConfig = {
  origins: [
    "https://cloudgpus.io",
    "https://www.cloudgpus.io",
    process.env.NODE_ENV === "development" && "http://localhost:3000",
  ].filter(Boolean),

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],

  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
};
```

### 11.4 Security Checklist

- [x] HTTPS only (Cloudflare + nginx-proxy)
- [x] No :latest Docker tags
- [x] Non-root container users
- [x] Network isolation (internal network)
- [x] Health checks enabled
- [x] Resource limits configured
- [x] Logging enabled
- [x] Secrets in environment (not files)
- [x] CORS properly configured
- [x] Rate limiting at edge (Cloudflare)
- [ ] API key rotation automation
- [ ] Vulnerability scanning (Trivy)
- [ ] Dependency auditing (npm audit)

---

## 12. Deployment Architecture

### 12.1 Deployment Flow

```
+============================================================================+
|                          DEPLOYMENT PIPELINE                               |
+============================================================================+

                    +-------------------+
                    |   GitHub Push     |
                    |   (main branch)   |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |   GitHub Actions  |
                    |   CI Workflow     |
                    +---------+---------+
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
        +-----------+   +-----------+   +-----------+
        |   Lint    |   |   Test    |   | TypeCheck |
        +-----------+   +-----------+   +-----------+
              |               |               |
              +-------+-------+-------+-------+
                      |
                      v
              +---------------+
              |  Build Images |
              |  (GHCR)       |
              +-------+-------+
                      |
                      v
              +---------------+
              |  Push to GHCR |
              +-------+-------+
                      |
                      v
              +---------------+
              |  SSH Deploy   |
              | 107.174.42.198|
              +-------+-------+
                      |
              +-------+-------+-------+
              |               |       |
              v               v       v
        +-----------+   +-----------+   +-----------+
        | Pull New  |   | docker    |   | Health    |
        | Images    |   | compose up|   | Check     |
        +-----------+   +-----------+   +-----------+
                              |
                              v
                      +---------------+
                      |   Notify      |
                      |   Slack       |
                      +---------------+
```

### 12.2 Zero-Downtime Deployment

```yaml
# docker-compose.yml deployment strategy
services:
  api:
    deploy:
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback
      rollback_config:
        parallelism: 0
        order: stop-first
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### 12.3 Rollback Procedure

```bash
# Emergency rollback
cd /opt/docker-projects/heavy-tasks/vibing-code/CloudGPUs.io

# 1. Get previous commit
PREV_COMMIT=$(git rev-parse HEAD~1)

# 2. Checkout previous version
git checkout $PREV_COMMIT

# 3. Redeploy
make deploy

# 4. Verify
make health
```

---

## 13. Monitoring and Observability

### 13.1 Monitoring Stack

| Tool            | Purpose                 | Access                  |
| --------------- | ----------------------- | ----------------------- |
| Dozzle          | Container logs          | logs.expertbeacon.com   |
| Uptime Kuma     | Availability monitoring | uptime.expertbeacon.com |
| Supabase Studio | Database management     | studio.expertbeacon.com |
| Umami           | Analytics               | umami.expertbeacon.com  |

### 13.2 Health Check Endpoints

```typescript
// GET /api/health
interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    redis: boolean;
    queues: Record<string, number>;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}
```

### 13.3 Alert Thresholds

| Metric           | Warning       | Critical      | Channel       |
| ---------------- | ------------- | ------------- | ------------- |
| API Response P95 | > 2s          | > 5s          | Slack         |
| Queue Depth      | > 100         | > 500         | Slack         |
| Error Rate       | > 1%          | > 5%          | Slack + Email |
| Memory Usage     | > 80%         | > 95%         | Slack         |
| Scrape Failure   | 2 consecutive | 3 consecutive | Slack         |
| Data Staleness   | > 12h         | > 24h         | Slack + Email |

### 13.4 Key Metrics Dashboard

```typescript
// Metrics to track
const METRICS = {
  // API
  api_requests_total: "counter",
  api_request_duration_seconds: "histogram",
  api_errors_total: "counter",

  // Workers
  jobs_processed_total: "counter",
  jobs_failed_total: "counter",
  job_duration_seconds: "histogram",
  queue_depth: "gauge",

  // Scraping
  scrape_success_total: "counter",
  scrape_failure_total: "counter",
  scrape_duration_seconds: "histogram",
  circuit_breaker_state: "gauge",

  // Data
  price_records_total: "gauge",
  stale_records_total: "gauge",
  last_scrape_timestamp: "gauge",

  // System
  memory_usage_bytes: "gauge",
  cpu_usage_percent: "gauge",
};
```

---

## 14. Technical Decisions

### 14.1 Technology Stack Rationale

| Component          | Choice                | Rationale                                     | Alternatives Considered |
| ------------------ | --------------------- | --------------------------------------------- | ----------------------- |
| CMS                | PayloadCMS 3.x        | TypeScript-native, self-hosted, excellent API | Strapi, Directus        |
| Queue              | BullMQ                | Redis-backed, mature, rate limiting           | Agenda, Bee-Queue       |
| Database           | PostgreSQL (Supabase) | Existing infra, schema isolation              | Dedicated Postgres      |
| Cache              | Redis                 | Queue + cache combo, existing                 | Memcached               |
| Frontend           | Next.js 14            | App Router, ISR, Cloudflare support           | Astro, Remix            |
| Hosting (API)      | Docker on VPS         | Full control, existing infra                  | Railway, Render         |
| Hosting (Frontend) | Cloudflare Pages      | Edge caching, free tier, ISR                  | Vercel                  |
| Proxy              | SOAX                  | Residential IPs, API included                 | Bright Data, Oxylabs    |
| Browser            | Playwright            | Best Cloudflare bypass, modern                | Puppeteer               |

### 14.2 Design Decisions

| Decision          | Choice             | Rationale                             |
| ----------------- | ------------------ | ------------------------------------- |
| Schema isolation  | `cloudgpus` schema | Multi-tenant safety, backup isolation |
| Price storage     | Cents (integer)    | Precision, no floating point issues   |
| Worker separation | 5 worker types     | Resource isolation, failure isolation |
| Cache layers      | 3 layers           | Performance, cost optimization        |
| ISR strategy      | Per-page-type TTL  | Balance freshness vs build cost       |

### 14.3 Trade-offs Accepted

| Trade-off             | Choice         | Consequence          | Mitigation           |
| --------------------- | -------------- | -------------------- | -------------------- |
| Shared Redis          | Use existing   | Potential contention | Dedicated if needed  |
| Browser worker memory | 4GB limit      | Max 2 concurrent     | Scale out if needed  |
| No message broker     | BullMQ direct  | Redis dependency     | Acceptable for scale |
| No K8s                | Docker Compose | Manual scaling       | Scripts + monitoring |

---

## 15. Appendices

### 15.1 Provider Adapter Checklist

| Provider     | Tier        | Adapter Type  | API Docs              | Status | Priority |
| ------------ | ----------- | ------------- | --------------------- | ------ | -------- |
| Lambda Labs  | Enterprise  | API           | docs.lambda.ai        | Ready  | P0       |
| RunPod       | Marketplace | API (GraphQL) | docs.runpod.io        | Ready  | P0       |
| Vast.ai      | DePIN       | Browser       | docs.vast.ai          | Ready  | P0       |
| CoreWeave    | Enterprise  | API (K8s)     | docs.coreweave.com    | TBD    | P1       |
| Nebius       | Regional    | API (gRPC)    | docs.nebius.com       | TBD    | P1       |
| GMI Cloud    | Regional    | API           | docs.gmicloud.ai      | TBD    | P1       |
| Hyperstack   | Regional    | API           | docs.hyperstack.cloud | TBD    | P1       |
| Voltage Park | Enterprise  | API           | docs.voltagepark.com  | TBD    | P1       |
| io.net       | DePIN       | API           | docs.io.net           | TBD    | P2       |
| Salad        | DePIN       | API           | docs.salad.com        | TBD    | P2       |
| TensorDock   | Marketplace | API           | docs.tensordock.com   | TBD    | P2       |

### 15.2 Environment Variables Reference

```bash
# Core
NODE_ENV=production
LOG_LEVEL=info
ADMIN_EMAIL=admin@cloudgpus.io

# PayloadCMS
PAYLOAD_SECRET=<32+ char secret>
PAYLOAD_PUBLIC_SERVER_URL=https://api.cloudgpus.io

# Database
DB_PASSWORD=<supabase password>
DATABASE_URI=postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/postgres?schema=cloudgpus

# Redis
REDIS_URL=redis://redis:6379/0

# CORS
CORS_ORIGINS=https://cloudgpus.io,https://www.cloudgpus.io

# Provider API Keys
LAMBDA_API_KEY=
RUNPOD_API_KEY=
VASTAI_API_KEY=
COREWEAVE_API_KEY=
NEBIUS_API_KEY=
GMI_API_KEY=
VOLTAGEPARK_API_KEY=
IONET_API_KEY=

# SOAX Proxy
SOAX_PROXY_URL=http://user:pass@gate.soax.com:5000

# Notifications
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=
SLACK_WEBHOOK_URL=

# Cloudflare
CF_REVALIDATE_URL=https://cloudgpus.io/api/revalidate
CF_REVALIDATE_SECRET=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=cloudgpus-uploads
R2_PUBLIC_URL=https://cdn.cloudgpus.io

# Monitoring
SENTRY_DSN=
```

### 15.3 Quick Reference Commands

```bash
# Deployment
make deploy              # Full deployment
make deploy-api          # API only
make deploy-workers      # Workers only
make down                # Stop all
make restart             # Restart all

# Monitoring
make logs                # All logs
make logs-api            # API logs
make logs-workers        # Worker logs
make status              # Service status
make health              # Health check

# Database
make db-backup           # Backup schema
make db-restore          # Restore backup
make db-migrate          # Run migrations
make db-shell            # PostgreSQL shell

# Development
make shell               # API container shell
make validate            # Validate compose
make clean               # Cleanup unused resources
```

---

**Document Version:** 2.0.0
**Last Updated:** 2025-12-30
**Next Review:** 2026-01-30

**Changelog:**

- v2.0.0: Complete architecture document with all sections
- v1.0.0: Initial architecture from cloudgpus-architecture.md
