import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";

const redisConnect = vi.fn(async () => undefined);
const redisPing = vi.fn(async () => "PONG");
const redisQuit = vi.fn(async () => undefined);

vi.mock("../../src/redis/client.js", () => {
  return {
    createRedis: () => ({ connect: redisConnect, ping: redisPing, quit: redisQuit }),
  };
});

describe("workers misc processors", () => {
  it("cleanupProcessor calls cleanup function", async () => {
    const calls: string[] = [];
    const pool = {
      query: async (sql: string) => {
        calls.push(sql);
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const { cleanupProcessor } = await import("../../src/workers/maintenance/processor.js");
    const run = cleanupProcessor(pool);
    await expect(run({ data: {} } as unknown as Job)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["SELECT cloudgpus.cleanup_stale_instances()"]);
  });

  it("apiSyncProcessor and providerUpdateProcessor return job name", async () => {
    const { apiSyncProcessor, providerUpdateProcessor } =
      await import("../../src/workers/api/processor.js");
    await expect(
      apiSyncProcessor({} as unknown as Pool)({ name: "api-sync" } as unknown as Job),
    ).resolves.toEqual({
      ok: true,
      job: "api-sync",
    });
    await expect(
      providerUpdateProcessor({} as unknown as Pool)({ name: "provider-update" } as unknown as Job),
    ).resolves.toEqual({
      ok: true,
      job: "provider-update",
    });
  });

  it("health checks ping Redis", async () => {
    vi.resetModules();
    redisConnect.mockClear();
    redisPing.mockClear();
    redisQuit.mockClear();

    const { check: checkWorker } = await import("../../src/workers/health.js");
    await checkWorker();
    expect(redisConnect).toHaveBeenCalledTimes(1);
    expect(redisPing).toHaveBeenCalledTimes(1);
    expect(redisQuit).toHaveBeenCalledTimes(1);

    const { check: checkBrowser } = await import("../../src/workers/browser-health.js");
    await checkBrowser();
    expect(redisConnect).toHaveBeenCalledTimes(2);
    expect(redisPing).toHaveBeenCalledTimes(2);
    expect(redisQuit).toHaveBeenCalledTimes(2);
  });
});
