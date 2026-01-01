import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { normalizeProviderSlug } from "../aliases.js";

const schema = z.object({
  providers: z
    .string()
    .min(3)
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export function compareProvidersHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success || parsed.data.providers.length !== 2) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Query must include providers=a,b",
        details: parsed.success ? { providers: parsed.data.providers } : parsed.error.flatten(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [aRaw, bRaw] = parsed.data.providers;
    const a = normalizeProviderSlug(aRaw!);
    const b = normalizeProviderSlug(bRaw!);
    if (a === b) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Providers must be different",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const providersRes = await pool.query<{
      id: string;
      slug: string;
      name: string;
      display_name: string;
      provider_type: string;
      reliability_tier: string;
      website_url: string;
      pricing_url: string | null;
      docs_url: string | null;
      affiliate_url: string | null;
    }>(
      `
      SELECT
        id, slug, name, display_name, provider_type, reliability_tier,
        website_url, pricing_url, docs_url, affiliate_url
      FROM cloudgpus.providers
      WHERE slug = ANY($1::text[])
      `,
      [[a, b]],
    );

    const p1 = providersRes.rows.find((p) => p.slug === a) ?? null;
    const p2 = providersRes.rows.find((p) => p.slug === b) ?? null;
    if (!p1 || !p2) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "One or more providers not found",
        details: { a, b },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const pricesRes = await pool.query<{
      provider_id: string;
      gpu_model_id: string;
      gpu_slug: string;
      gpu_name: string;
      min_on_demand: string | null;
      min_spot: string | null;
      last_updated: string;
    }>(
      `
      SELECT
        i.provider_id,
        i.gpu_model_id,
        g.slug AS gpu_slug,
        g.name AS gpu_name,
        MIN(i.price_per_gpu_hour)::text AS min_on_demand,
        MIN((i.price_per_hour_spot / NULLIF(i.gpu_count, 0)))::text AS min_spot,
        MAX(i.last_scraped_at)::text AS last_updated
      FROM cloudgpus.instances i
      JOIN cloudgpus.gpu_models g ON g.id = i.gpu_model_id
      WHERE i.is_active = true
        AND i.provider_id = ANY($1::uuid[])
      GROUP BY i.provider_id, i.gpu_model_id, g.slug, g.name
      `,
      [[p1.id, p2.id]],
    );

    const byProvider = new Map<string, typeof pricesRes.rows>();
    for (const row of pricesRes.rows) {
      const list = byProvider.get(row.provider_id) ?? [];
      list.push(row);
      byProvider.set(row.provider_id, list);
    }

    const list1 = byProvider.get(p1.id) ?? [];
    const list2 = byProvider.get(p2.id) ?? [];

    const map1 = new Map(list1.map((r) => [r.gpu_slug, r]));
    const map2 = new Map(list2.map((r) => [r.gpu_slug, r]));
    const commonSlugs = [...map1.keys()].filter((k) => map2.has(k)).sort();

    const commonGpus = commonSlugs.map((slug) => {
      const left = map1.get(slug)!;
      const right = map2.get(slug)!;
      return {
        gpu: { slug, name: left.gpu_name },
        provider1: {
          onDemand: left.min_on_demand ? Number(left.min_on_demand) : null,
          spot: left.min_spot ? Number(left.min_spot) : null,
        },
        provider2: {
          onDemand: right.min_on_demand ? Number(right.min_on_demand) : null,
          spot: right.min_spot ? Number(right.min_spot) : null,
        },
      };
    });

    const median = (vals: number[]) => {
      if (!vals.length) return null;
      const sorted = [...vals].sort((x, y) => x - y);
      return sorted[Math.floor(sorted.length / 2)] ?? null;
    };

    const prices1 = list1
      .map((r) => (r.min_on_demand ? Number(r.min_on_demand) : NaN))
      .filter(Number.isFinite);
    const prices2 = list2
      .map((r) => (r.min_on_demand ? Number(r.min_on_demand) : NaN))
      .filter(Number.isFinite);
    const med1 = median(prices1);
    const med2 = median(prices2);

    const cheaper =
      med1 == null || med2 == null ? "tie" : med1 < med2 ? p1.slug : med2 < med1 ? p2.slug : "tie";
    const moreGpus =
      list1.length === list2.length ? "tie" : list1.length > list2.length ? p1.slug : p2.slug;

    const betterFor = [
      {
        useCase: "llm-training",
        provider: p1.reliability_tier === "enterprise" ? p1.slug : p2.slug,
      },
      {
        useCase: "price-sensitive-dev",
        provider: p1.provider_type === "marketplace" ? p1.slug : p2.slug,
      },
    ];

    res.json({
      provider1: p1,
      provider2: p2,
      commonGpus,
      verdict: { cheaper, moreGpus, betterFor },
      generatedAt: new Date().toISOString(),
    });
  };
}
