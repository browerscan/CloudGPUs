import pg from "pg";
import { getEnv } from "../env.js";

export function createPool() {
  const env = getEnv();
  const maxConnections = env.DB_POOL_MAX ? Number(env.DB_POOL_MAX) : 20;

  return new pg.Pool({
    connectionString: env.DATABASE_URI,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30_000,
  });
}

export type DbPool = ReturnType<typeof createPool>;
