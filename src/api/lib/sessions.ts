import type { Pool } from "pg";
import { nanoid } from "nanoid";

export type SessionRecord = {
  id: string;
  token_id: string;
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function createSession(args: {
  pool: Pool;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  expiresAt?: Date | null;
}) {
  const tokenId = nanoid(32);
  const res = await args.pool.query<{ id: string }>(
    `
    INSERT INTO cloudgpus.user_sessions
      (user_id, token_id, ip, user_agent, last_seen_at, expires_at)
    VALUES
      ($1, $2, $3, $4, NOW(), $5)
    RETURNING id
    `,
    [args.userId, tokenId, args.ip ?? null, args.userAgent ?? null, args.expiresAt ?? null],
  );

  return { sessionId: res.rows[0]!.id, tokenId };
}

export async function listSessions(pool: Pool, userId: string) {
  const res = await pool.query<SessionRecord>(
    `
    SELECT id, token_id, user_id, ip, user_agent, created_at::text, last_seen_at::text,
           expires_at::text, revoked_at::text
    FROM cloudgpus.user_sessions
    WHERE user_id = $1
    ORDER BY COALESCE(last_seen_at, created_at) DESC
    `,
    [userId],
  );
  return res.rows;
}

export async function revokeSession(pool: Pool, args: { userId: string; sessionId: string }) {
  const res = await pool.query(
    `
    UPDATE cloudgpus.user_sessions
    SET revoked_at = NOW(), revoke_reason = 'manual'
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    RETURNING id
    `,
    [args.sessionId, args.userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function revokeAllSessions(
  pool: Pool,
  args: { userId: string; exceptSessionId?: string | undefined },
) {
  const res = await pool.query(
    `
    UPDATE cloudgpus.user_sessions
    SET revoked_at = NOW(), revoke_reason = 'manual'
    WHERE user_id = $1
      AND revoked_at IS NULL
      AND ($2::uuid IS NULL OR id <> $2::uuid)
    `,
    [args.userId, args.exceptSessionId ?? null],
  );
  return res.rowCount;
}

export async function touchSession(pool: Pool, args: { sessionId: string }) {
  await pool.query(
    `
    UPDATE cloudgpus.user_sessions
    SET last_seen_at = NOW()
    WHERE id = $1
    `,
    [args.sessionId],
  );
}
