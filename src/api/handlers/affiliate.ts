import type { Request, Response } from "express";
import type { Pool } from "pg";
import { nanoid } from "nanoid";
import { z } from "zod";
import { normalizeGpuSlug, normalizeProviderSlug } from "../aliases.js";

const schema = z.object({
  provider: z.string().min(1),
  gpu: z.string().optional(),
  instance: z.string().uuid().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
});

function getOrSetSessionId(req: Request, res: Response) {
  const existing = req.cookies?.["cg_sid"];
  if (typeof existing === "string" && existing.length > 0) return existing;

  const sid = nanoid(24);
  // Check for HTTPS via req.secure or X-Forwarded-Proto header
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.cookie("cg_sid", sid, {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 90 * 1000,
  });
  return sid;
}

export function affiliateClickHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
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
    const sessionId = getOrSetSessionId(req, res);

    const providerSlug = normalizeProviderSlug(q.provider);
    const providerRes = await pool.query<{
      id: string;
      affiliate_url: string | null;
      pricing_url: string | null;
      website_url: string;
    }>(
      `
      SELECT id, affiliate_url, pricing_url, website_url
      FROM cloudgpus.providers
      WHERE slug = $1
      LIMIT 1
      `,
      [providerSlug],
    );
    const provider = providerRes.rows[0];

    if (!provider) {
      res.status(404).json({
        status: 404,
        error: "not_found",
        message: "Provider not found",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const gpuId = q.gpu
      ? ((
          await pool.query<{ id: string }>(
            "SELECT id FROM cloudgpus.gpu_models WHERE slug = $1 LIMIT 1",
            [normalizeGpuSlug(q.gpu)],
          )
        ).rows[0]?.id ?? null)
      : null;

    const ip = req.ip;
    const userAgent = req.get("user-agent") ?? null;
    const referrer = req.get("referer") ?? null;

    const clickInsert = await pool.query<{ id: string }>(
      `
      INSERT INTO cloudgpus.affiliate_clicks (
        provider_id,
        gpu_model_id,
        instance_id,
        session_id,
        ip,
        user_agent,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
      `,
      [
        provider.id,
        gpuId,
        q.instance ?? null,
        sessionId,
        ip,
        userAgent,
        referrer,
        q.utm_source ?? null,
        q.utm_medium ?? null,
        q.utm_campaign ?? null,
        q.utm_term ?? null,
        q.utm_content ?? null,
      ],
    );
    const clickId = clickInsert.rows[0]?.id ?? null;

    const destination = provider.affiliate_url ?? provider.pricing_url ?? provider.website_url;

    // Validate redirect URL to prevent open redirect attacks
    let url: URL;
    try {
      url = new URL(destination);
      // Only allow safe protocols
      const allowedProtocols = ["http:", "https:"];
      if (!allowedProtocols.includes(url.protocol)) {
        res.status(400).json({
          status: 400,
          error: "bad_request",
          message: "Invalid redirect destination",
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch {
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Invalid redirect configuration",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Pass a stable click ID through to the provider URL for affiliate postback attribution.
    // Many affiliate networks allow you to capture custom parameters (e.g. "subid") and send them back via postback.
    if (clickId) url.searchParams.set("cg_click_id", clickId);

    for (const [k, v] of Object.entries(q)) {
      if (!k.startsWith("utm_") || !v) continue;
      url.searchParams.set(k, v);
    }

    res.redirect(302, url.toString());
  };
}
