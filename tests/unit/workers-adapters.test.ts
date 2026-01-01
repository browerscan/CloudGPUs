import { describe, expect, it } from "vitest";
import { StaticAdapter } from "../../src/workers/adapters/static.js";
import { LambdaAdapter } from "../../src/workers/adapters/lambda.js";
import { EmptyAdapter } from "../../src/workers/adapters/empty.js";
import { normalizeGpuSlug } from "../../src/workers/adapters/gpu-slugs.js";

describe("workers adapters", () => {
  it("normalizes GPU names to canonical slugs", () => {
    expect(normalizeGpuSlug("NVIDIA H100 SXM")).toBe("h100-sxm");
    expect(normalizeGpuSlug("H100 PCIe")).toBe("h100-pcie");
    expect(normalizeGpuSlug("RTX 5090")).toBe("rtx-5090");
    expect(normalizeGpuSlug("unknown")).toBe(null);
  });

  it("StaticAdapter returns deterministic pricing", async () => {
    const ctx = { provider: { slug: "runpod" }, now: new Date(), scrape: {} } as never;
    const lambda = await new StaticAdapter("lambda-labs").fetchPricing(ctx);
    const other = await new StaticAdapter("some-provider").fetchPricing(ctx);

    expect(lambda).toHaveLength(3);
    expect(lambda[0]).toEqual(
      expect.objectContaining({
        providerSlug: "lambda-labs",
        gpuSlug: "h100-sxm",
        pricePerHour: 2.25,
      }),
    );
    expect(other[0]).toEqual(
      expect.objectContaining({
        providerSlug: "some-provider",
        gpuSlug: "h100-sxm",
        pricePerHour: 2.5,
      }),
    );
  });

  it("LambdaAdapter parses instance types and maps to PricingInstance rows", async () => {
    process.env["LAMBDA_API_KEY"] = "key";
    const adapter = new LambdaAdapter("lambda-labs");
    const out = await adapter.fetchPricing({
      provider: { slug: "lambda-labs" },
      now: new Date(),
      scrape: {
        fetchJson: async () => ({
          finalUrl: "https://cloud.lambdalabs.com/api/v1/instance-types",
          status: 200,
          json: {
            data: {
              instance_types: [
                {
                  name: "gpu_1x_h100_sxm",
                  gpu_name: "NVIDIA H100 SXM",
                  gpu_count: 1,
                  price_per_hour: 2.5,
                },
                { name: "bad", gpu_name: "unknown", gpu_count: 1, price_per_hour: 1.0 },
                { name: "free", gpu_name: "H100", gpu_count: 1, price_per_hour: 0 },
              ],
            },
          },
        }),
      },
    } as never);

    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(
      expect.objectContaining({
        providerSlug: "lambda-labs",
        gpuSlug: "h100-sxm",
        gpuCount: 1,
        pricePerHour: 2.5,
        currency: "USD",
      }),
    );
  });

  it("LambdaAdapter surfaces auth/upstream errors", async () => {
    process.env["LAMBDA_API_KEY"] = "key";
    const adapter = new LambdaAdapter("lambda-labs");

    await expect(
      adapter.fetchPricing({
        provider: { slug: "lambda-labs" },
        now: new Date(),
        scrape: { fetchJson: async () => ({ finalUrl: "", status: 401, json: {} }) },
      } as never),
    ).rejects.toThrow("unauthorized");

    await expect(
      adapter.fetchPricing({
        provider: { slug: "lambda-labs" },
        now: new Date(),
        scrape: { fetchJson: async () => ({ finalUrl: "", status: 429, json: {} }) },
      } as never),
    ).rejects.toThrow("upstream_429");
  });

  it("EmptyAdapter returns no instances", async () => {
    const adapter = new EmptyAdapter("empty");
    const out = await adapter.fetchPricing({ provider: { slug: "empty" } } as never);
    expect(out).toEqual([]);
  });
});
