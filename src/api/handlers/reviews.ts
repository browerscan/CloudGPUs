import type { Request, Response } from "express";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import { normalizeProviderSlug } from "../aliases.js";
import { badRequest, notFound } from "../error-responses.js";
import { NotFoundError, findProviderIdBySlug } from "../repositories/shared.js";
import { QUEUES } from "../../workers/queues.js";

const createSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(20).max(4000),
  authorName: z.string().max(120).optional(),
  authorEmail: z.string().email().optional(),
});

export function listProviderReviewsHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      badRequest(res, undefined, "Missing provider slug");
      return;
    }

    const providerSlug = normalizeProviderSlug(slug);
    let providerId: string;
    try {
      providerId = await findProviderIdBySlug(pool, providerSlug);
    } catch (e) {
      if (e instanceof NotFoundError) {
        notFound(res, "Provider");
        return;
      }
      throw e;
    }

    const reviewsRes = await pool.query<{
      id: string;
      rating: number;
      title: string | null;
      body: string;
      author_name: string | null;
      created_at: string;
    }>(
      `
      SELECT id, rating, title, body, author_name, created_at::text
      FROM cloudgpus.provider_reviews
      WHERE provider_id = $1
        AND is_published = true
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [providerId],
    );

    res.status(200).json({
      provider: providerSlug,
      reviews: reviewsRes.rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.author_name,
        createdAt: r.created_at,
      })),
    });
  };
}

export function createProviderReviewHandler(args: { pool: Pool; redis: Redis }) {
  return async (req: Request, res: Response) => {
    const slug = req.params["slug"];
    if (!slug) {
      badRequest(res, undefined, "Missing provider slug");
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.flatten(), "Invalid request body");
      return;
    }

    const providerSlug = normalizeProviderSlug(slug);
    let providerId: string;
    try {
      providerId = await findProviderIdBySlug(args.pool, providerSlug);
    } catch (e) {
      if (e instanceof NotFoundError) {
        notFound(res, "Provider");
        return;
      }
      throw e;
    }

    const insertRes = await args.pool.query<{ id: string }>(
      `
      INSERT INTO cloudgpus.provider_reviews (
        provider_id, rating, title, body, author_name, author_email
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [
        providerId,
        parsed.data.rating,
        parsed.data.title ?? null,
        parsed.data.body,
        parsed.data.authorName ?? null,
        parsed.data.authorEmail ?? null,
      ],
    );

    // Notify ops for moderation.
    const slack = new Queue(QUEUES.notifySlack, { connection: args.redis });
    await slack.add(
      "slack",
      {
        text: `New provider review submitted for ${providerSlug} (rating ${parsed.data.rating}/5). Review ID: ${insertRes.rows[0]!.id}`,
      },
      {
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
      },
    );
    await slack.close();

    res.status(201).json({ ok: true, id: insertRes.rows[0]!.id, published: false });
  };
}
