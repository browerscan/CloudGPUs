import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

const h = vi.hoisted(() => {
  return {
    getAdapter: vi.fn(),
    createScrapeClient: vi.fn(),
    createScrapeJobInPool: vi.fn(),
    finishScrapeJobInPool: vi.fn(),
    withTx: vi.fn(),
    upsertInstancesForProvider: vi.fn(),
    queueAdds: [] as Array<{ queue: string; name: string; data: unknown }>,
  };
});

vi.mock("bullmq", () => {
  class Queue {
    private name: string;
    constructor(name: string) {
      this.name = name;
    }
    async add(name: string, data: unknown) {
      h.queueAdds.push({ queue: this.name, name, data });
      return { id: "job-1" };
    }
    async close() {
      return;
    }
  }
  return { Queue };
});

vi.mock("../../src/workers/adapters/registry.js", () => ({ getAdapter: h.getAdapter }));
vi.mock("../../src/workers/scrape/client.js", () => ({ createScrapeClient: h.createScrapeClient }));
vi.mock("../../src/workers/db.js", () => ({
  withTx: h.withTx,
  createScrapeJobInPool: h.createScrapeJobInPool,
  finishScrapeJobInPool: h.finishScrapeJobInPool,
  upsertInstancesForProvider: h.upsertInstancesForProvider,
}));

describe("workers/pricing fetch processor", () => {
  it("throws when provider slug is unknown", async () => {
    vi.resetModules();
    h.queueAdds.length = 0;
    h.createScrapeClient.mockReturnValue({});
    h.createScrapeJobInPool.mockResolvedValue("scrape-1");
    h.finishScrapeJobInPool.mockResolvedValue(undefined);
    h.withTx.mockImplementation(async (_pool: Pool, fn: (client: unknown) => Promise<unknown>) =>
      fn({}),
    );
    h.upsertInstancesForProvider.mockResolvedValue({
      created: 0,
      updated: 0,
      deactivated: 0,
      seen: 0,
    });
    h.getAdapter.mockReturnValue({ slug: "mock", fetchPricing: vi.fn() });

    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as unknown as Pool;
    const redis = { status: "ready" } as unknown as Redis;

    const { pricingFetchProcessor } = await import("../../src/workers/pricing/processor.js");
    const run = pricingFetchProcessor({ pool, redis });
    await expect(run({ data: { providerSlug: "nope" } } as unknown as Job)).rejects.toThrow(
      "provider_not_found:nope",
    );
  });

  it("runs a successful scrape and records completion", async () => {
    vi.resetModules();
    h.queueAdds.length = 0;

    h.createScrapeClient.mockReturnValue({
      fetchJson: vi.fn(),
      fetchText: vi.fn(),
      browserHtml: vi.fn(),
    });
    h.createScrapeJobInPool.mockResolvedValue("scrape-1");
    h.finishScrapeJobInPool.mockResolvedValue(undefined);
    h.withTx.mockImplementation(async (_pool: Pool, fn: (client: unknown) => Promise<unknown>) =>
      fn({}),
    );
    h.upsertInstancesForProvider.mockResolvedValue({
      created: 1,
      updated: 1,
      deactivated: 0,
      seen: 2,
    });

    const adapterFetch = vi.fn(async () => [
      {
        providerSlug: "lambda-labs",
        gpuSlug: "h100-sxm",
        instanceType: "h100",
        gpuCount: 1,
        pricePerHour: 2.5,
      },
      {
        providerSlug: "lambda-labs",
        gpuSlug: "a100-80gb",
        instanceType: "a100",
        gpuCount: 1,
        pricePerHour: 2.0,
      },
    ]);
    h.getAdapter.mockReturnValue({ slug: "lambda-labs", fetchPricing: adapterFetch });

    const pool = {
      query: async (sql: string) => {
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = $1")) {
          return {
            rows: [
              {
                id: "prov-1",
                slug: "lambda-labs",
                name: "Lambda",
                pricing_url: "https://example.com/pricing",
                api_base_url: null,
                has_public_api: true,
                provider_type: "specialized_neocloud",
                reliability_tier: "enterprise",
                supports_spot_instances: false,
                supports_reserved_instances: false,
              },
            ],
            rowCount: 1,
          };
        }

        if (sql.includes("INSERT INTO cloudgpus.price_anomalies")) {
          return { rows: [], rowCount: 0 };
        }

        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;

    const { pricingFetchProcessor } = await import("../../src/workers/pricing/processor.js");
    const run = pricingFetchProcessor({ pool, redis });
    const out = await run({ data: { providerSlug: "lambda-labs" } } as unknown as Job);

    expect(out).toEqual(expect.objectContaining({ providerSlug: "lambda-labs", anomalies: 0 }));
    expect(adapterFetch).toHaveBeenCalledTimes(1);
    expect(h.finishScrapeJobInPool).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        instancesFound: 2,
        instancesCreated: 1,
        instancesUpdated: 1,
      }),
    );
    expect(h.queueAdds).toHaveLength(0);
  });

  it("enqueues a Slack notification when anomalies are detected", async () => {
    vi.resetModules();
    h.queueAdds.length = 0;

    h.createScrapeClient.mockReturnValue({
      fetchJson: vi.fn(),
      fetchText: vi.fn(),
      browserHtml: vi.fn(),
    });
    h.createScrapeJobInPool.mockResolvedValue("scrape-2");
    h.finishScrapeJobInPool.mockResolvedValue(undefined);
    h.withTx.mockImplementation(async (_pool: Pool, fn: (client: unknown) => Promise<unknown>) =>
      fn({}),
    );
    h.upsertInstancesForProvider.mockResolvedValue({
      created: 0,
      updated: 0,
      deactivated: 0,
      seen: 0,
    });
    h.getAdapter.mockReturnValue({ slug: "lambda-labs", fetchPricing: vi.fn(async () => []) });

    const pool = {
      query: async (sql: string) => {
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = $1")) {
          return {
            rows: [
              {
                id: "prov-1",
                slug: "lambda-labs",
                name: "Lambda",
                pricing_url: null,
                api_base_url: null,
                has_public_api: true,
                provider_type: "specialized_neocloud",
                reliability_tier: "enterprise",
                supports_spot_instances: false,
                supports_reserved_instances: false,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO cloudgpus.price_anomalies")) {
          return { rows: [{ id: "a1" }, { id: "a2" }], rowCount: 2 };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const { pricingFetchProcessor } = await import("../../src/workers/pricing/processor.js");
    const run = pricingFetchProcessor({ pool, redis });
    const out = await run({ data: { providerSlug: "lambda-labs" } } as unknown as Job);

    expect(out.anomalies).toBe(2);
    expect(h.queueAdds).toEqual([
      expect.objectContaining({
        queue: "slack",
        name: "slack",
        data: expect.objectContaining({ text: expect.stringContaining("anomaly") }),
      }),
    ]);
  });

  it("classifies timeouts and records failed scrape jobs", async () => {
    vi.resetModules();
    h.queueAdds.length = 0;

    h.createScrapeClient.mockReturnValue({
      fetchJson: vi.fn(),
      fetchText: vi.fn(),
      browserHtml: vi.fn(),
    });
    h.createScrapeJobInPool.mockResolvedValue("scrape-3");
    h.finishScrapeJobInPool.mockResolvedValue(undefined);
    h.getAdapter.mockReturnValue({
      slug: "lambda-labs",
      fetchPricing: vi.fn(async () => {
        throw new Error("ETIMEDOUT");
      }),
    });

    const pool = {
      query: async (sql: string) => {
        if (sql.includes("FROM cloudgpus.providers") && sql.includes("WHERE slug = $1")) {
          return {
            rows: [
              {
                id: "prov-1",
                slug: "lambda-labs",
                name: "Lambda",
                pricing_url: null,
                api_base_url: null,
                has_public_api: true,
                provider_type: "specialized_neocloud",
                reliability_tier: "standard",
                supports_spot_instances: false,
                supports_reserved_instances: false,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const redis = { status: "ready" } as unknown as Redis;
    const { pricingFetchProcessor } = await import("../../src/workers/pricing/processor.js");
    const run = pricingFetchProcessor({ pool, redis });

    await expect(run({ data: { providerSlug: "lambda-labs" } } as unknown as Job)).rejects.toThrow(
      "ETIMEDOUT",
    );
    expect(h.finishScrapeJobInPool).toHaveBeenCalledWith(
      expect.objectContaining({ status: "timeout", errorCode: "timeout" }),
    );
  });
});
