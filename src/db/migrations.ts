import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";

export function stripPsqlMetaCommands(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("\\"))
    .join("\n");
}

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id bigserial PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(client: PoolClient, filename: string) {
  const res = await client.query<{ filename: string }>(
    "SELECT filename FROM public.schema_migrations WHERE filename = $1",
    [filename],
  );
  return (res.rowCount ?? 0) > 0;
}

function checksum(contents: string) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

export async function runMigrations(pool: Pool, migrationsDir = "migrations") {
  const dir = path.resolve(process.cwd(), migrationsDir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    // Convention: rollback scripts are kept in the same folder but should never be auto-applied.
    .filter((e) => !e.name.endsWith("_rollback.sql"))
    // Convention: only apply numbered migrations like `001_initial_schema.sql`.
    .filter((e) => /^\d+_.+\.sql$/.test(e.name))
    .map((e) => e.name)
    .sort();

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    for (const filename of files) {
      if (await alreadyApplied(client, filename)) continue;

      const fullPath = path.join(dir, filename);
      const raw = await fs.readFile(fullPath, "utf8");
      const sql = stripPsqlMetaCommands(raw);

      await client.query(sql);
      await client.query(
        "INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)",
        [filename, checksum(raw)],
      );
    }
  } finally {
    client.release();
  }
}
