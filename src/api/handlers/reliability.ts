import type { Request, Response } from "express";
import type { Pool } from "pg";
import { normalizeProviderSlug } from "../aliases.js";
import { badRequest, notFound } from "../error-responses.js";
import { NotFoundError, findProviderBySlug } from "../repositories/shared.js";

export function providerReliabilityHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      badRequest(res, undefined, "Missing provider slug");
      return;
    }

    const normalized = normalizeProviderSlug(slug);
    let provider: Awaited<ReturnType<typeof findProviderBySlug>>;
    try {
      provider = await findProviderBySlug(pool, normalized);
    } catch (e) {
      if (e instanceof NotFoundError) {
        notFound(res, "Provider");
        return;
      }
      throw e;
    }

    const jobsRes = await pool.query<{
      total: string;
      completed: string;
      failed: string;
      timeout: string;
      rate_limited: string;
      avg_duration_ms: string | null;
    }>(
      `
      SELECT
        count(*)::text AS total,
        count(*) FILTER (WHERE status = 'completed')::text AS completed,
        count(*) FILTER (WHERE status = 'failed')::text AS failed,
        count(*) FILTER (WHERE status = 'timeout')::text AS timeout,
        count(*) FILTER (WHERE status = 'rate_limited')::text AS rate_limited,
        avg(duration_ms)::text AS avg_duration_ms
      FROM cloudgpus.scrape_jobs
      WHERE provider_id = $1
        AND started_at > now() - interval '30 days'
      `,
      [provider.id],
    );
    const jobs = jobsRes.rows[0]!;

    const total = Number(jobs.total);
    const completed = Number(jobs.completed);
    const completionRate = total > 0 ? completed / total : null;

    const badge = (() => {
      if (completionRate == null) return "unknown" as const;
      if (completionRate >= 0.95) return "green" as const;
      if (completionRate >= 0.85) return "yellow" as const;
      return "red" as const;
    })();

    res.json({
      provider: {
        slug: provider.slug,
        providerType: provider.provider_type,
        reliabilityTier: provider.reliability_tier,
        slaUptimePercent: provider.sla_uptime_percent ? Number(provider.sla_uptime_percent) : null,
      },
      last30d: {
        total,
        completed,
        failed: Number(jobs.failed),
        timeout: Number(jobs.timeout),
        rateLimited: Number(jobs.rate_limited),
        avgDurationMs: jobs.avg_duration_ms ? Number(jobs.avg_duration_ms) : null,
        completionRate,
      },
      score: {
        badge,
        jobCompletionRate: completionRate != null ? Math.round(completionRate * 1000) / 10 : null,
      },
      generatedAt: new Date().toISOString(),
    });
  };
}
