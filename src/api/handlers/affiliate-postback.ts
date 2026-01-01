import type { Request, Response } from "express";
import type { Pool } from "pg";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getEnv } from "../../env.js";

function constantTimeEquals(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

const schema = z.object({
  click_id: z.string().uuid(),
  external_id: z.string().min(1).max(200).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  revenue: z.coerce.number().nonnegative().optional(),
  commission: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  occurred_at: z.string().optional(),
});

export function affiliatePostbackHandler(pool: Pool) {
  const env = getEnv();
  const secret = env.AFFILIATE_POSTBACK_SECRET ?? "";
  const enabled = Boolean(secret);

  return async (req: Request, res: Response) => {
    // Always require authentication for financial endpoints - never bypass, even in non-production
    if (!enabled) {
      res.status(501).json({
        status: 501,
        error: "not_configured",
        message: "Affiliate postback is not configured.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const headerSecret = req.get("x-affiliate-secret");
    // Only accept secret via header for security; query string is not allowed
    const supplied = headerSecret ?? "";

    if (!supplied || !constantTimeEquals(supplied, secret)) {
      res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Invalid credentials.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        status: 400,
        error: "bad_request",
        message: "Invalid query",
        details: parsed.error.flatten(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const q = parsed.data;
    const clickRes = await pool.query<{ provider_id: string }>(
      `
      SELECT provider_id
      FROM cloudgpus.affiliate_clicks
      WHERE id = $1
      LIMIT 1
      `,
      [q.click_id],
    );
    const click = clickRes.rows[0];
    if (!click) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "Affiliate click not found.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const occurredAt = q.occurred_at ? new Date(q.occurred_at) : null;
    const occurredAtIso =
      occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt.toISOString() : null;

    const rawData = { ...req.query };
    if ("secret" in rawData) delete rawData["secret"];

    const insertRes = await pool.query<{ id: string }>(
      `
      INSERT INTO cloudgpus.affiliate_conversions (
        provider_id,
        affiliate_click_id,
        external_id,
        status,
        revenue_amount,
        commission_amount,
        currency,
        occurred_at,
        raw_data
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (provider_id, external_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        revenue_amount = COALESCE(EXCLUDED.revenue_amount, cloudgpus.affiliate_conversions.revenue_amount),
        commission_amount = COALESCE(EXCLUDED.commission_amount, cloudgpus.affiliate_conversions.commission_amount),
        currency = EXCLUDED.currency,
        occurred_at = COALESCE(EXCLUDED.occurred_at, cloudgpus.affiliate_conversions.occurred_at),
        raw_data = cloudgpus.affiliate_conversions.raw_data || EXCLUDED.raw_data
      RETURNING id
      `,
      [
        click.provider_id,
        q.click_id,
        q.external_id ?? null,
        q.status ?? "pending",
        q.revenue ?? null,
        q.commission ?? null,
        (q.currency ?? "USD").toUpperCase(),
        occurredAtIso,
        rawData,
      ],
    );

    res.json({
      ok: true,
      conversionId: insertRes.rows[0]?.id ?? null,
      timestamp: new Date().toISOString(),
    });
  };
}
