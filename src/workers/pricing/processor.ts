import { Queue } from "bullmq";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { getAdapter } from "../adapters/registry.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { createScrapeClient } from "../scrape/client.js";
import { QUEUES } from "../queues.js";
import {
  createScrapeJobInPool,
  finishScrapeJobInPool,
  upsertInstancesForProvider,
  withTx,
} from "../db.js";

const schema = z.object({
  providerSlug: z.string().min(1),
});

const breakers = new Map<string, CircuitBreaker>();

function breakerFor(args: { providerSlug: string; reliabilityTier?: string | null }) {
  const tier = args.reliabilityTier ?? "standard";
  const cfg =
    tier === "enterprise"
      ? { failureThreshold: 3, openTimeoutMs: 5 * 60_000 }
      : tier === "community"
        ? { failureThreshold: 5, openTimeoutMs: 10 * 60_000 }
        : { failureThreshold: 4, openTimeoutMs: 5 * 60_000 };
  const existing = breakers.get(args.providerSlug);
  if (existing) return existing;
  const next = new CircuitBreaker(cfg);
  breakers.set(args.providerSlug, next);
  return next;
}

function classifyFailure(err: unknown): {
  status: "failed" | "timeout" | "rate_limited";
  code?: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("circuit_open")) return { status: "failed", code: "circuit_open" };
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
    return { status: "timeout", code: "timeout" };
  if (msg.includes("429") || msg.includes("rate_limited"))
    return { status: "rate_limited", code: "rate_limited" };
  return { status: "failed", code: msg.slice(0, 50) };
}

export function pricingFetchProcessor(args: { pool: Pool; redis: Redis }) {
  const scrape = createScrapeClient({ redis: args.redis });

  return async (job: Job) => {
    const startedAt = Date.now();
    const { providerSlug } = schema.parse(job.data);

    const providerRes = await args.pool.query<{
      id: string;
      slug: string;
      name: string;
      pricing_url: string | null;
      api_base_url: string | null;
      has_public_api: boolean;
      provider_type: string;
      reliability_tier: string;
      supports_spot_instances: boolean;
      supports_reserved_instances: boolean;
    }>(
      `
      SELECT
        id, slug, name,
        pricing_url, api_base_url, has_public_api,
        provider_type, reliability_tier,
        supports_spot_instances, supports_reserved_instances
      FROM cloudgpus.providers
      WHERE slug = $1
      LIMIT 1
      `,
      [providerSlug],
    );
    const provider = providerRes.rows[0];
    const providerId = provider?.id;
    if (!providerId) throw new Error(`provider_not_found:${providerSlug}`);

    const scrapeJobId = await createScrapeJobInPool(args.pool, providerId);
    const adapter = getAdapter({
      id: providerId,
      slug: provider.slug,
      name: provider.name,
      pricingUrl: provider.pricing_url,
      apiBaseUrl: provider.api_base_url,
      hasPublicApi: provider.has_public_api,
      providerType: provider.provider_type,
      reliabilityTier: provider.reliability_tier,
      supportsSpotInstances: provider.supports_spot_instances,
      supportsReservedInstances: provider.supports_reserved_instances,
    });

    try {
      const instances = await breakerFor({
        providerSlug,
        reliabilityTier: provider.reliability_tier,
      }).exec(() =>
        adapter.fetchPricing({
          provider: {
            id: providerId,
            slug: provider.slug,
            name: provider.name,
            pricingUrl: provider.pricing_url,
            apiBaseUrl: provider.api_base_url,
            hasPublicApi: provider.has_public_api,
            providerType: provider.provider_type,
            reliabilityTier: provider.reliability_tier,
            supportsSpotInstances: provider.supports_spot_instances,
            supportsReservedInstances: provider.supports_reserved_instances,
          },
          now: new Date(),
          scrape,
        }),
      );

      const upserted = await withTx(args.pool, async (client) =>
        upsertInstancesForProvider({
          client,
          providerId,
          scrapeJobId,
          instances,
        }),
      );

      // Detect anomalies (>50% price change) for this provider+scrape.
      const anomaliesRes = await args.pool.query<{ id: string }>(
        `
        WITH latest AS (
          SELECT
            ph.id AS price_history_id,
            ph.instance_id,
            ph.provider_id,
            ph.gpu_model_id,
            ph.price_per_gpu_hour,
            LAG(ph.price_per_gpu_hour) OVER (PARTITION BY ph.instance_id ORDER BY ph.recorded_at) AS prev_price,
            ROW_NUMBER() OVER (PARTITION BY ph.instance_id ORDER BY ph.recorded_at DESC) AS rn_desc,
            ph.recorded_at
          FROM cloudgpus.price_history ph
          JOIN cloudgpus.instances i ON i.id = ph.instance_id
          WHERE i.provider_id = $1
            AND i.scrape_job_id = $2
        )
        INSERT INTO cloudgpus.price_anomalies (
          price_history_id,
          instance_id,
          provider_id,
          gpu_model_id,
          old_price_per_gpu_hour,
          new_price_per_gpu_hour,
          change_percent
        )
        SELECT
          latest.price_history_id,
          latest.instance_id,
          latest.provider_id,
          latest.gpu_model_id,
          latest.prev_price,
          latest.price_per_gpu_hour,
          CASE
            WHEN latest.prev_price IS NULL OR latest.prev_price = 0 THEN NULL
            ELSE ROUND(((latest.price_per_gpu_hour - latest.prev_price) / latest.prev_price) * 100, 2)
          END AS change_percent
        FROM latest
        WHERE latest.rn_desc = 1
          AND latest.prev_price IS NOT NULL
          AND latest.recorded_at >= (SELECT started_at FROM cloudgpus.scrape_jobs WHERE id = $2)
          AND ABS((latest.price_per_gpu_hour - latest.prev_price) / latest.prev_price) >= 0.5
        ON CONFLICT (price_history_id) DO NOTHING
        RETURNING id
        `,
        [providerId, scrapeJobId],
      );

      if (anomaliesRes.rowCount && anomaliesRes.rowCount > 0) {
        const slack = new Queue(QUEUES.notifySlack, { connection: args.redis });
        await slack.add(
          "slack",
          {
            text: `Price anomaly detected for ${providerSlug}: ${anomaliesRes.rowCount} change(s) exceeded 50% (scrape ${scrapeJobId}).`,
          },
          {
            removeOnComplete: { age: 3600, count: 5000 },
            removeOnFail: { age: 24 * 3600, count: 5000 },
          },
        );
        await slack.close();
      }

      await finishScrapeJobInPool({
        pool: args.pool,
        jobId: scrapeJobId,
        status: "completed",
        startedAt,
        instancesFound: instances.length,
        instancesUpdated: upserted.updated,
        instancesCreated: upserted.created,
        instancesDeactivated: upserted.deactivated,
      });

      return { providerSlug, ...upserted, anomalies: anomaliesRes.rowCount ?? 0 };
    } catch (err) {
      const classified = classifyFailure(err);
      await finishScrapeJobInPool({
        pool: args.pool,
        jobId: scrapeJobId,
        status: classified.status,
        startedAt,
        errorMessage: err instanceof Error ? err.message : String(err),
        ...(classified.code ? { errorCode: classified.code } : {}),
      });
      throw err;
    }
  };
}
