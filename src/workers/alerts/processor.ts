import type { Job } from "bullmq";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { QUEUES } from "../queues.js";

const jobSchema = z.object({});

export function alertsProcessor(args: { pool: Pool; redis: Redis }) {
  return async (job: Job) => {
    jobSchema.parse(job.data ?? {});

    const subsRes = await args.pool.query<{
      id: string;
      email: string;
      gpu_model_id: string;
      provider_id: string | null;
      target_price_per_gpu_hour: string;
      unsubscribe_token: string;
      gpu_slug: string;
      gpu_name: string;
      provider_slug: string | null;
      provider_display_name: string | null;
    }>(
      `
      SELECT
        s.id,
        s.email,
        s.gpu_model_id,
        s.provider_id,
        s.target_price_per_gpu_hour::text,
        s.unsubscribe_token,
        g.slug AS gpu_slug,
        g.name AS gpu_name,
        p.slug AS provider_slug,
        p.display_name AS provider_display_name
      FROM cloudgpus.price_alert_subscriptions s
      JOIN cloudgpus.gpu_models g ON g.id = s.gpu_model_id
      LEFT JOIN cloudgpus.providers p ON p.id = s.provider_id
      WHERE s.is_active = true
        AND s.confirmed_at IS NOT NULL
        AND (s.last_notified_at IS NULL OR s.last_notified_at < NOW() - INTERVAL '12 hours')
      ORDER BY s.created_at ASC
      LIMIT 250
      `,
    );

    if (!subsRes.rowCount) return { ok: true, processed: 0, notified: 0 };

    const emailQueue = new Queue(QUEUES.notifyEmail, { connection: args.redis });
    let notified = 0;

    for (const sub of subsRes.rows) {
      const target = Number(sub.target_price_per_gpu_hour);
      if (!Number.isFinite(target) || target <= 0) continue;

      const priceRes = await args.pool.query<{ min: string | null }>(
        `
        SELECT MIN(price_per_gpu_hour)::text AS min
        FROM cloudgpus.instances
        WHERE is_active = true
          AND gpu_model_id = $1
          AND ($2::uuid IS NULL OR provider_id = $2::uuid)
        `,
        [sub.gpu_model_id, sub.provider_id],
      );
      const min = priceRes.rows[0]?.min ? Number(priceRes.rows[0].min) : null;
      if (min == null || !Number.isFinite(min)) continue;
      if (min > target) continue;

      const providerText = sub.provider_display_name ? ` on ${sub.provider_display_name}` : "";
      const subject = `CloudGPUs.io alert: ${sub.gpu_slug} is now $${min.toFixed(2)}/GPU-hr${providerText}`;
      const site = process.env["PUBLIC_SITE_URL"] ?? "https://cloudgpus.io";
      const unsubUrl = `${site.replace(/\/$/, "")}/api/alerts/unsubscribe?token=${encodeURIComponent(
        sub.unsubscribe_token,
      )}`;

      await emailQueue.add(
        "email",
        {
          to: sub.email,
          subject,
          text:
            `Good news — ${sub.gpu_name} pricing hit your target.\n\n` +
            `Current best price: $${min.toFixed(2)}/GPU-hour${providerText}\n` +
            `Target price: $${target.toFixed(2)}/GPU-hour\n\n` +
            `Compare live prices: ${site.replace(/\/$/, "")}/cloud-gpu/${sub.gpu_slug}\n\n` +
            `Unsubscribe: ${unsubUrl}\n`,
        },
        {
          removeOnComplete: { age: 24 * 3600, count: 5000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      );

      await args.pool.query(
        "UPDATE cloudgpus.price_alert_subscriptions SET last_notified_at = NOW() WHERE id = $1",
        [sub.id],
      );

      notified += 1;
    }

    await emailQueue.close();
    return { ok: true, processed: subsRes.rowCount ?? 0, notified };
  };
}
