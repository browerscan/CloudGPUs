import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { runMigrations } from "../../src/db/migrations.js";

describe("runMigrations", () => {
  it("applies numbered SQL files and records schema_migrations", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudgpus-migrations-"));
    await fs.writeFile(path.join(dir, "001_init.sql"), "\\echo hi\nSELECT 1;\n");
    await fs.writeFile(path.join(dir, "002_next.sql"), "SELECT 2;\n");
    await fs.writeFile(path.join(dir, "003_ignore_rollback.sql"), "SELECT 999;\n");
    await fs.writeFile(path.join(dir, "notes.sql"), "SELECT 0;\n");

    const executed: Array<{ sql: string; params?: unknown[] }> = [];

    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        executed.push(typeof params === "undefined" ? { sql } : { sql, params });
        if (sql.startsWith("SELECT filename FROM public.schema_migrations")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await runMigrations(pool, dir);

    const appliedSql = executed
      .map((e) => e.sql)
      .filter(
        (s) => !s.includes("CREATE TABLE") && !s.includes("INSERT INTO public.schema_migrations"),
      );

    expect(appliedSql.join("\n")).toContain("SELECT 1;");
    expect(appliedSql.join("\n")).toContain("SELECT 2;");
    expect(appliedSql.join("\n")).not.toContain("SELECT 999;");
    expect(appliedSql.join("\n")).not.toContain("SELECT 0;");

    // psql meta commands stripped
    expect(appliedSql.join("\n")).not.toContain("\\echo");

    const inserts = executed.filter((e) => e.sql.includes("INSERT INTO public.schema_migrations"));
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.params?.[0]).toBe("001_init.sql");
    expect(typeof inserts[0]?.params?.[1]).toBe("string");
    expect(String(inserts[0]?.params?.[1]).length).toBe(64);
  });
});
