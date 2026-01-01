import type { Request, Response } from "express";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { nanoid } from "nanoid";
import { z } from "zod";
import { normalizeGpuSlug, normalizeProviderSlug } from "../aliases.js";
import { badRequest, notFound } from "../error-responses.js";
import {
  NotFoundError,
  findGpuModelIdBySlug,
  findProviderIdBySlug,
} from "../repositories/shared.js";
import { QUEUES } from "../../workers/queues.js";

const subscribeSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(255, "Email is too long"),
  gpuSlug: z.string().min(1, "GPU slug is required").max(50, "GPU slug is too long"),
  providerSlug: z
    .string()
    .min(1, "Provider slug is too short")
    .max(50, "Provider slug is too long")
    .optional(),
  targetPricePerGpuHour: z
    .union([z.number(), z.string()])
    .transform((val, ctx): number => {
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target price must be a valid number",
        });
        return z.NEVER;
      }
      return num;
    })
    .refine((n) => n > 0, {
      message: "Target price must be greater than 0",
    })
    .refine((n) => n <= 1000, {
      message: "Target price must be less than or equal to $1000",
    }),
});

export function alertsSubscribeHandler(args: { pool: Pool; redis: Redis }) {
  return async (req: Request, res: Response) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.flatten(), "Invalid request body");
      return;
    }

    const site = process.env["PUBLIC_SITE_URL"] ?? "https://cloudgpus.io";

    const gpuSlug = normalizeGpuSlug(parsed.data.gpuSlug);
    let gpuId: string;
    try {
      gpuId = await findGpuModelIdBySlug(args.pool, gpuSlug);
    } catch (e) {
      if (e instanceof NotFoundError) {
        notFound(res, "GPU");
        return;
      }
      throw e;
    }

    // Fetch GPU details for response
    const gpuRes = await args.pool.query<{ slug: string; name: string }>(
      "SELECT slug, name FROM cloudgpus.gpu_models WHERE id = $1 LIMIT 1",
      [gpuId],
    );
    const gpu = gpuRes.rows[0]!;

    let providerId: string | null = null;
    let providerSlug: string | null = null;
    if (parsed.data.providerSlug) {
      providerSlug = normalizeProviderSlug(parsed.data.providerSlug);
      try {
        providerId = await findProviderIdBySlug(args.pool, providerSlug);
      } catch (e) {
        if (e instanceof NotFoundError) {
          notFound(res, "Provider");
          return;
        }
        throw e;
      }
    }

    const existingRes = await args.pool.query<{
      id: string;
      confirmed_at: string | null;
      confirm_token: string;
      unsubscribe_token: string;
    }>(
      `
      SELECT id, confirmed_at::text, confirm_token, unsubscribe_token
      FROM cloudgpus.price_alert_subscriptions
      WHERE email = $1
        AND gpu_model_id = $2
        AND provider_id IS NOT DISTINCT FROM $3::uuid
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [parsed.data.email, gpuId, providerId],
    );

    let confirmToken = nanoid(32);
    let unsubscribeToken = nanoid(32);
    let status: "pending_confirmation" | "already_confirmed" = "pending_confirmation";

    if (existingRes.rows[0]) {
      confirmToken = existingRes.rows[0].confirm_token;
      unsubscribeToken = existingRes.rows[0].unsubscribe_token;
      status = existingRes.rows[0].confirmed_at ? "already_confirmed" : "pending_confirmation";

      await args.pool.query(
        `
        UPDATE cloudgpus.price_alert_subscriptions
        SET target_price_per_gpu_hour = $2, is_active = true
        WHERE id = $1
        `,
        [existingRes.rows[0].id, parsed.data.targetPricePerGpuHour],
      );
    } else {
      await args.pool.query(
        `
        INSERT INTO cloudgpus.price_alert_subscriptions (
          email,
          gpu_model_id,
          provider_id,
          target_price_per_gpu_hour,
          confirm_token,
          unsubscribe_token
        ) VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          parsed.data.email,
          gpuId,
          providerId,
          parsed.data.targetPricePerGpuHour,
          confirmToken,
          unsubscribeToken,
        ],
      );
    }

    if (status === "pending_confirmation") {
      const confirmUrl = `${site.replace(/\/$/, "")}/alerts/confirm?token=${encodeURIComponent(confirmToken)}`;
      const unsubUrl = `${site.replace(/\/$/, "")}/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

      const emailQueue = new Queue(QUEUES.notifyEmail, { connection: args.redis });
      await emailQueue.add(
        "email",
        {
          to: parsed.data.email,
          subject: `Confirm your CloudGPUs.io price alert for ${gpu.name}`,
          text:
            `Confirm your alert:\n${confirmUrl}\n\n` +
            `Target price: $${parsed.data.targetPricePerGpuHour.toFixed(2)}/GPU-hour\n\n` +
            `Manage/Unsubscribe:\n${unsubUrl}\n`,
        },
        {
          removeOnComplete: { age: 24 * 3600, count: 5000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
        },
      );
      await emailQueue.close();
    }

    res.status(200).json({
      ok: true,
      status,
      gpu: { slug: gpu.slug, name: gpu.name },
      provider: providerSlug,
      targetPricePerGpuHour: parsed.data.targetPricePerGpuHour,
      confirmToken: status === "pending_confirmation" ? confirmToken : null,
    });
  };
}

const tokenSchema = z.object({ token: z.string().min(8) });

export function alertsConfirmHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = tokenSchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(res, undefined, "Missing token");
      return;
    }

    const row = await pool.query<{ id: string; gpu_slug: string }>(
      `
      UPDATE cloudgpus.price_alert_subscriptions s
      SET confirmed_at = COALESCE(s.confirmed_at, NOW())
      FROM cloudgpus.gpu_models g
      WHERE s.confirm_token = $1
        AND s.gpu_model_id = g.id
      RETURNING s.id, g.slug AS gpu_slug
      `,
      [parsed.data.token],
    );

    if (!row.rowCount) {
      notFound(res, "Invalid token");
      return;
    }

    res.status(200).json({ ok: true, confirmed: true, gpuSlug: row.rows[0]!.gpu_slug });
  };
}

export function alertsUnsubscribeHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = tokenSchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(res, undefined, "Missing token");
      return;
    }

    const row = await pool.query<{ id: string }>(
      `
      UPDATE cloudgpus.price_alert_subscriptions
      SET is_active = false
      WHERE unsubscribe_token = $1
      RETURNING id
      `,
      [parsed.data.token],
    );

    if (!row.rowCount) {
      notFound(res, "Invalid token");
      return;
    }

    res.status(200).json({ ok: true, unsubscribed: true });
  };
}
