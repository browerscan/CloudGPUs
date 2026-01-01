import { z } from "zod";
import type { AdapterContext, PricingInstance, ProviderAdapter } from "./types.js";
import { normalizeGpuSlug } from "./gpu-slugs.js";

const responseSchema = z.object({
  data: z
    .object({
      // Lambda returns list of instance types. The exact payload can evolve, so we validate loosely.
      "instance-types": z.array(z.unknown()).optional(),
      instance_types: z.array(z.unknown()).optional(),
      instanceTypes: z.array(z.unknown()).optional(),
    })
    .optional(),
  "instance-types": z.array(z.unknown()).optional(),
  instance_types: z.array(z.unknown()).optional(),
  instanceTypes: z.array(z.unknown()).optional(),
});

function pickArray(json: unknown): unknown[] {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return [];
  const root = parsed.data;
  const fromRoot = root["instance-types"] ?? root.instance_types ?? root.instanceTypes ?? undefined;
  if (Array.isArray(fromRoot)) return fromRoot;
  const fromData =
    root.data?.["instance-types"] ??
    root.data?.instance_types ??
    root.data?.instanceTypes ??
    undefined;
  if (Array.isArray(fromData)) return fromData;
  return [];
}

export class LambdaAdapter implements ProviderAdapter {
  constructor(public slug: string) {}

  async fetchPricing(ctx: AdapterContext): Promise<PricingInstance[]> {
    const apiKey = process.env["LAMBDA_API_KEY"];
    if (!apiKey) throw new Error("missing_lambda_api_key");

    const { json, status } = await ctx.scrape.fetchJson<unknown>({
      url: "https://cloud.lambdalabs.com/api/v1/instance-types",
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: 30_000,
    });

    if (status === 401 || status === 403) throw new Error("unauthorized");
    if (status >= 429) throw new Error(`upstream_${status}`);

    const items = pickArray(json);
    const out: PricingInstance[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;

      const name =
        (typeof r["name"] === "string" && r["name"]) ||
        (typeof r["instance_type"] === "string" && r["instance_type"]) ||
        (typeof r["instanceType"] === "string" && r["instanceType"]) ||
        null;

      const gpuName =
        (typeof r["gpu_name"] === "string" && r["gpu_name"]) ||
        (typeof r["gpu"] === "string" && r["gpu"]) ||
        (typeof r["gpu_type"] === "string" && r["gpu_type"]) ||
        name ||
        null;

      const gpuSlug = gpuName ? normalizeGpuSlug(gpuName) : null;
      if (!gpuSlug) continue;

      const gpuCount =
        (typeof r["gpu_count"] === "number" && r["gpu_count"]) ||
        (typeof r["gpus"] === "number" && r["gpus"]) ||
        1;

      const hourly =
        (typeof r["price"] === "number" && r["price"]) ||
        (typeof r["price_per_hour"] === "number" && r["price_per_hour"]) ||
        (typeof r["cost_per_hour"] === "number" && r["cost_per_hour"]) ||
        null;

      if (!hourly || !Number.isFinite(hourly) || hourly <= 0) continue;

      out.push({
        providerSlug: ctx.provider.slug,
        gpuSlug,
        instanceType: name ? String(name) : `${gpuSlug}:${gpuCount}`,
        ...(name ? { instanceName: String(name) } : {}),
        gpuCount: Number(gpuCount) || 1,
        pricePerHour: Number(hourly),
        currency: "USD",
        availabilityStatus: "available",
        sourceUrl: "https://cloud.lambdalabs.com/api/v1/instance-types",
        rawData: raw,
      });
    }

    return out;
  }
}
