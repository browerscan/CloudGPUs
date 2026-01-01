# CloudGPUs.io API Spec (OpenAPI 3.0)

This document describes the public JSON API served by the backend on `https://api.cloudgpus.io` (default). It is optimized for pSEO pages, comparison tools, and programmatic exports.

```yaml
openapi: 3.0.3
info:
  title: CloudGPUs.io API
  version: 0.1.0
servers:
  - url: https://api.cloudgpus.io
paths:
  /api/health:
    get:
      summary: Health check
      responses:
        "200":
          description: OK
  /api/providers:
    get:
      summary: List providers
      parameters:
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: sort
          schema: { type: string, example: "name" }
          description: Use "-field" for DESC (e.g. "-last_price_update")
        - in: query
          name: where[provider_type][equals]
          schema: { type: string }
        - in: query
          name: where[reliability_tier][equals]
          schema: { type: string, enum: [enterprise, standard, community] }
      responses:
        "200":
          description: Paginated provider list
  /api/providers/{slug}:
    get:
      summary: Get provider by slug
      parameters:
        - in: path
          name: slug
          required: true
          schema: { type: string }
      responses:
        "200": { description: Provider }
        "404": { description: Not found }
  /api/providers/{slug}/reliability:
    get:
      summary: Provider reliability signal (last 30d scrape completion)
      parameters:
        - in: path
          name: slug
          required: true
          schema: { type: string }
      responses:
        "200": { description: Reliability summary }
  /api/providers/{slug}/reviews:
    get:
      summary: List published reviews for a provider
      parameters:
        - in: path
          name: slug
          required: true
          schema: { type: string }
      responses:
        "200": { description: Review list }
    post:
      summary: Create a provider review (queued for moderation)
      parameters:
        - in: path
          name: slug
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [rating, body]
              properties:
                rating: { type: integer, minimum: 1, maximum: 5 }
                title: { type: string }
                body: { type: string }
                authorName: { type: string }
      responses:
        "201": { description: Created }
  /api/gpu-models:
    get:
      summary: List GPU models
      parameters:
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: sort
          schema: { type: string, example: "-vram_gb" }
        - in: query
          name: where[architecture][equals]
          schema: { type: string }
      responses:
        "200": { description: Paginated GPU list }
  /api/gpu-models/{slug}:
    get:
      summary: Get GPU model by slug
      parameters:
        - in: path
          name: slug
          required: true
          schema: { type: string }
      responses:
        "200": { description: GPU model }
        "404": { description: Not found }
  /api/instances:
    get:
      summary: List instances (normalized pricing rows)
      description: Query uses Payload-style filters such as where[field][equals].
      parameters:
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: depth
          schema: { type: integer, minimum: 0, maximum: 2, default: 0 }
          description: When >= 1, joins provider/gpu metadata into each row.
        - in: query
          name: sort
          schema: { type: string, example: "price_per_gpu_hour" }
        - in: query
          name: region
          schema: { type: string, example: "us-east" }
          description: Filters by instances where available_regions contains this value.
        - in: query
          name: where[provider_id][equals]
          schema: { type: string, format: uuid }
        - in: query
          name: where[gpu_model_id][equals]
          schema: { type: string, format: uuid }
        - in: query
          name: where[availability_status][equals]
          schema: { type: string }
        - in: query
          name: where[price_per_gpu_hour][less_than]
          schema: { type: number }
        - in: query
          name: where[is_active][equals]
          schema: { type: boolean }
      responses:
        "200": { description: Paginated instances }
  /api/compare-prices:
    get:
      summary: Compare prices for a GPU (cheapest per provider)
      parameters:
        - in: query
          name: gpuSlug
          required: true
          schema: { type: string, example: "h100-sxm" }
        - in: query
          name: tier
          schema: { type: string, enum: [enterprise, standard, community] }
        - in: query
          name: includeSpot
          schema: { type: boolean, default: false }
        - in: query
          name: maxPrice
          schema: { type: number }
      responses:
        "200": { description: Comparison response }
  /api/compare-providers:
    get:
      summary: Compare two providers head-to-head
      parameters:
        - in: query
          name: providers
          required: true
          schema: { type: string, example: "lambda-labs,runpod" }
      responses:
        "200": { description: Provider comparison response }
  /api/price-history:
    get:
      summary: 90-day price history for a GPU (optionally filtered by provider)
      parameters:
        - in: query
          name: gpuSlug
          required: true
          schema: { type: string }
        - in: query
          name: provider
          schema: { type: string }
        - in: query
          name: days
          schema: { type: integer, minimum: 1, maximum: 365, default: 30 }
      responses:
        "200": { description: Price history points }
  /api/export/instances.csv:
    get:
      summary: CSV export of instance rows
      parameters:
        - in: query
          name: gpu
          schema: { type: string }
        - in: query
          name: provider
          schema: { type: string }
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 5000, default: 500 }
      responses:
        "200":
          description: CSV file
          content:
            text/csv: {}
  /api/export/compare.csv:
    get:
      summary: CSV export of compare-prices response
      parameters:
        - in: query
          name: gpuSlug
          required: true
          schema: { type: string }
        - in: query
          name: tier
          schema: { type: string, enum: [enterprise, standard, community] }
        - in: query
          name: includeSpot
          schema: { type: boolean, default: false }
        - in: query
          name: maxPrice
          schema: { type: number }
      responses:
        "200":
          description: CSV file
          content:
            text/csv: {}
  /api/stats/cheapest:
    get:
      summary: Cheapest observed offers by GPU (cached)
      responses:
        "200": { description: Stats payload }
  /api/alerts/subscribe:
    post:
      summary: Subscribe to price alerts
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, gpuSlug, targetPrice]
              properties:
                email: { type: string, format: email }
                gpuSlug: { type: string }
                targetPrice: { type: number, minimum: 0 }
      responses:
        "200": { description: Accepted }
  /api/alerts/confirm:
    get:
      summary: Confirm an alert subscription
      parameters:
        - in: query
          name: token
          required: true
          schema: { type: string }
      responses:
        "200": { description: Confirmed }
  /api/alerts/unsubscribe:
    get:
      summary: Unsubscribe from alerts
      parameters:
        - in: query
          name: token
          required: true
          schema: { type: string }
      responses:
        "200": { description: Unsubscribed }
  /api/affiliate/click:
    get:
      summary: Track an affiliate click and redirect to provider URL
      parameters:
        - in: query
          name: provider
          required: true
          schema: { type: string }
        - in: query
          name: gpu
          schema: { type: string }
        - in: query
          name: instance
          schema: { type: string, format: uuid }
        - in: query
          name: utm_source
          schema: { type: string }
        - in: query
          name: utm_medium
          schema: { type: string }
        - in: query
          name: utm_campaign
          schema: { type: string }
      responses:
        "302": { description: Redirect }
  /api/affiliate/postback:
    get:
      summary: Record affiliate conversion via server-to-server postback
      description: Requires secret via query param `secret=` or header `x-affiliate-secret`.
      parameters:
        - in: query
          name: click_id
          required: true
          schema: { type: string, format: uuid }
        - in: query
          name: external_id
          schema: { type: string }
        - in: query
          name: revenue
          schema: { type: number }
        - in: query
          name: commission
          schema: { type: number }
        - in: query
          name: currency
          schema: { type: string, example: "USD" }
        - in: query
          name: occurred_at
          schema: { type: string, example: "2025-12-31T00:00:00Z" }
      responses:
        "200": { description: Recorded }
        "401": { description: Unauthorized }
```
