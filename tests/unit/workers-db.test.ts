import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import {
  createScrapeJob,
  createScrapeJobInPool,
  finishScrapeJob,
  finishScrapeJobInPool,
  upsertInstancesForProvider,
  withTx,
} from "../../src/workers/db.js";

describe("workers/db", () => {
  it("withTx commits on success", async () => {
    const calls: string[] = [];

    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql.trim());
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    const result = await withTx(pool, async (tx) => {
      await tx.query("SELECT 1");
      return 123;
    });

    expect(result).toBe(123);
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");
    expect((client as unknown as { release: () => void }).release).toHaveBeenCalledTimes(1);
  });

  it("withTx rolls back on failure", async () => {
    const calls: string[] = [];

    const client = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql.trim());
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;

    await expect(
      withTx(pool, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(calls).toContain("BEGIN");
    expect(calls).toContain("ROLLBACK");
    expect((client as unknown as { release: () => void }).release).toHaveBeenCalledTimes(1);
  });

  it("upserts instances and deactivates missing ones", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];

    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push(typeof params === "undefined" ? { sql } : { sql, params });

        if (sql.includes("SELECT id FROM cloudgpus.gpu_models")) {
          const slug = params?.[0];
          if (slug === "missing-gpu") return { rows: [], rowCount: 0 };
          return { rows: [{ id: "gpu-1" }], rowCount: 1 };
        }

        if (sql.includes("INSERT INTO cloudgpus.instances")) {
          const instanceType = params?.[2];
          const inserted = instanceType === "type-new";
          return { rows: [{ id: "inst-1", inserted }], rowCount: 1 };
        }

        if (sql.includes("UPDATE cloudgpus.instances")) {
          return { rows: [], rowCount: 3 };
        }

        return { rows: [], rowCount: 0 };
      }),
    } as unknown as PoolClient;

    const result = await upsertInstancesForProvider({
      client,
      providerId: "prov-1",
      scrapeJobId: "job-1",
      instances: [
        {
          providerSlug: "p",
          gpuSlug: "h100-sxm",
          instanceType: "type-new",
          gpuCount: 1,
          pricePerHour: 2.5,
        },
        {
          providerSlug: "p",
          gpuSlug: "h100-sxm",
          instanceType: "type-existing",
          gpuCount: 1,
          pricePerHour: 3.0,
        },
        {
          providerSlug: "p",
          gpuSlug: "missing-gpu",
          instanceType: "type-skip",
          gpuCount: 1,
          pricePerHour: 1.0,
        },
      ],
    });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.deactivated).toBe(3);

    const deactivate = queries.find((q) => q.sql.includes("AND instance_type <> ALL"))!;
    expect(deactivate.params?.[1]).toEqual(["type-new", "type-existing", "type-skip"]);
  });

  it("creates and finishes scrape jobs (pool + client helpers)", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(2_000);

    const poolQueries: Array<{ sql: string; params?: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        poolQueries.push(typeof params === "undefined" ? { sql } : { sql, params });
        if (sql.includes("INSERT INTO cloudgpus.scrape_jobs")) {
          return { rows: [{ id: "job-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as Pool;

    const jobId = await createScrapeJobInPool(pool, "prov-1");
    expect(jobId).toBe("job-1");

    await finishScrapeJobInPool({
      pool,
      jobId,
      status: "completed",
      startedAt: 1_000,
      instancesFound: 3,
      instancesCreated: 1,
      instancesUpdated: 1,
      instancesDeactivated: 1,
    });

    expect(poolQueries.some((q) => q.sql.includes("UPDATE cloudgpus.scrape_jobs"))).toBe(true);

    const clientQueries: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        clientQueries.push(typeof params === "undefined" ? { sql } : { sql, params });
        if (sql.includes("INSERT INTO cloudgpus.scrape_jobs")) {
          return { rows: [{ id: "job-2" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as PoolClient;

    const jobId2 = await createScrapeJob(client, "prov-1");
    expect(jobId2).toBe("job-2");
    await finishScrapeJob({
      client,
      jobId: jobId2,
      status: "failed",
      startedAt: 1_500,
      errorMessage: "boom",
    });
    expect(clientQueries.some((q) => q.sql.includes("UPDATE cloudgpus.scrape_jobs"))).toBe(true);

    now.mockRestore();
  });
});
