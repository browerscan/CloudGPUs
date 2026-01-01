import type { AdapterContext, PricingInstance, ProviderAdapter } from "./types.js";

// Deterministic fallback adapter that provides a small, representative set of instances.
// This ensures the pipeline (workers -> DB -> API -> frontend) is functional even without API keys.
export class StaticAdapter implements ProviderAdapter {
  constructor(public slug: string) {}

  async fetchPricing(_ctx: AdapterContext): Promise<PricingInstance[]> {
    const base =
      this.slug === "lambda-labs"
        ? 2.25
        : this.slug === "runpod"
          ? 2.1
          : this.slug === "vast-ai"
            ? 1.6
            : 2.5;

    return [
      {
        providerSlug: this.slug,
        gpuSlug: "h100-sxm",
        instanceType: "h100-80gb",
        instanceName: "H100 80GB",
        gpuCount: 1,
        pricePerHour: round(base, 2),
        pricePerHourSpot: round(base * 0.75, 2),
        availabilityStatus: "available",
        regions: ["us-east"],
      },
      {
        providerSlug: this.slug,
        gpuSlug: "a100-80gb",
        instanceType: "a100-80gb",
        instanceName: "A100 80GB",
        gpuCount: 1,
        pricePerHour: round(base * 0.85, 2),
        pricePerHourSpot: round(base * 0.62, 2),
        availabilityStatus: "available",
        regions: ["us-east"],
      },
      {
        providerSlug: this.slug,
        gpuSlug: "rtx-4090",
        instanceType: "rtx-4090",
        instanceName: "RTX 4090",
        gpuCount: 1,
        pricePerHour: round(base * 0.45, 2),
        pricePerHourSpot: round(base * 0.32, 2),
        availabilityStatus: "available",
        regions: ["us-east"],
      },
    ];
  }
}

function round(v: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}
