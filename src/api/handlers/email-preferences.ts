import type { Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { verifyPreferencesToken } from "../lib/preference-token.js";

const querySchema = z.object({
  token: z.string().min(8).optional(),
});

const updateSchema = z.object({
  token: z.string().min(8).optional(),
  marketingOptIn: z.boolean().optional(),
  productUpdatesOptIn: z.boolean().optional(),
});

function resolveEmail(req: Request, token?: string) {
  const authed = (req as Request & { user?: { email: string } }).user?.email ?? null;
  if (authed) return authed;
  if (!token) return null;
  const parsed = verifyPreferencesToken(token);
  return parsed?.email ?? null;
}

export function getEmailPreferencesHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        status: 400,
        error: "invalid_request",
        message: "Invalid token",
      });
    }

    const email = resolveEmail(req, parsed.data.token);
    if (!email) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Missing or invalid preferences token",
      });
    }

    const result = await pool.query<{
      email: string;
      marketing_opt_in: boolean;
      product_updates_opt_in: boolean;
      updated_at: string;
    }>(
      `
      SELECT email, marketing_opt_in, product_updates_opt_in, updated_at::text
      FROM cloudgpus.email_preferences
      WHERE email = $1
      `,
      [email.toLowerCase()],
    );

    const row = result.rows[0];
    if (!row) {
      return res.json({
        status: 200,
        data: {
          email,
          marketingOptIn: true,
          productUpdatesOptIn: true,
          updatedAt: null,
        },
      });
    }

    res.json({
      status: 200,
      data: {
        email: row.email,
        marketingOptIn: row.marketing_opt_in,
        productUpdatesOptIn: row.product_updates_opt_in,
        updatedAt: row.updated_at,
      },
    });
  };
}

export function updateEmailPreferencesHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: 400,
        error: "invalid_request",
        message: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const email = resolveEmail(req, parsed.data.token);
    if (!email) {
      return res.status(401).json({
        status: 401,
        error: "unauthorized",
        message: "Missing or invalid preferences token",
      });
    }

    const marketingOptIn = parsed.data.marketingOptIn ?? true;
    const productUpdatesOptIn = parsed.data.productUpdatesOptIn ?? true;

    const result = await pool.query<{
      email: string;
      marketing_opt_in: boolean;
      product_updates_opt_in: boolean;
      updated_at: string;
    }>(
      `
      INSERT INTO cloudgpus.email_preferences
        (email, marketing_opt_in, product_updates_opt_in)
      VALUES
        ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        marketing_opt_in = EXCLUDED.marketing_opt_in,
        product_updates_opt_in = EXCLUDED.product_updates_opt_in,
        updated_at = NOW()
      RETURNING email, marketing_opt_in, product_updates_opt_in, updated_at::text
      `,
      [email.toLowerCase(), marketingOptIn, productUpdatesOptIn],
    );

    const row = result.rows[0]!;
    res.json({
      status: 200,
      message: "Preferences updated",
      data: {
        email: row.email,
        marketingOptIn: row.marketing_opt_in,
        productUpdatesOptIn: row.product_updates_opt_in,
        updatedAt: row.updated_at,
      },
    });
  };
}
