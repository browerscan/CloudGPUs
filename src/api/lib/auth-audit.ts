import type { Pool } from "pg";
import { logger } from "../../logger.js";

export type AuthEvent = {
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason?: string | null;
  eventType?: string;
  riskScore?: number;
};

async function countFailures(pool: Pool, where: string, params: unknown[]) {
  const res = await pool.query<{
    fail_1h: string;
    fail_24h: string;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE success = false AND created_at > NOW() - INTERVAL '1 hour')::text AS fail_1h,
      COUNT(*) FILTER (WHERE success = false AND created_at > NOW() - INTERVAL '24 hours')::text AS fail_24h
    FROM cloudgpus.auth_events
    WHERE ${where}
    `,
    params,
  );

  const row = res.rows[0] ?? { fail_1h: "0", fail_24h: "0" };
  return {
    fail1h: Number(row.fail_1h) || 0,
    fail24h: Number(row.fail_24h) || 0,
  };
}

export async function computeRiskScore(
  pool: Pool,
  args: { ip?: string | null; email?: string | null },
) {
  try {
    let score = 0;
    if (!args.ip) score += 10;
    if (!args.email) score += 5;

    if (args.ip) {
      const ipCounts = await countFailures(pool, "ip = $1", [args.ip]);
      score += Math.min(40, ipCounts.fail1h * 8);
      score += Math.min(20, ipCounts.fail24h * 2);
    }

    if (args.email) {
      const emailCounts = await countFailures(pool, "email = $1", [args.email]);
      score += Math.min(30, emailCounts.fail1h * 10);
      score += Math.min(15, emailCounts.fail24h * 2);
    }

    return Math.min(100, score);
  } catch (err) {
    logger.warn({ err }, "Failed to compute auth risk score");
    return 0;
  }
}

export async function recordAuthEvent(pool: Pool, event: AuthEvent) {
  try {
    await pool.query(
      `
      INSERT INTO cloudgpus.auth_events
        (user_id, email, ip, user_agent, success, reason, event_type, risk_score)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event.userId ?? null,
        event.email ?? null,
        event.ip ?? null,
        event.userAgent ?? null,
        event.success,
        event.reason ?? null,
        event.eventType ?? "login",
        event.riskScore ?? 0,
      ],
    );
  } catch (err) {
    logger.warn({ err }, "Failed to record auth event");
  }
}
