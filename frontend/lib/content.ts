import type { ComparePricesResponse, GpuModel } from "./api";
export {
  H200_CONTENT,
  B200_CONTENT,
  getGpuContent,
  generateEnhancedGpuIntro,
  generateEnhancedGpuFaqs,
} from "./content/gpu-content";

export function generateGpuIntro(gpu: GpuModel, compare: ComparePricesResponse) {
  const prices = compare.prices
    .map((p) => p.onDemand ?? p.spot ?? null)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  const cheapest = prices.length ? prices[0]! : null;
  const providers = new Set(compare.prices.map((p) => p.provider.slug));
  const providerCount = providers.size;

  const trend = "Pricing is refreshed regularly from our backend pipeline.";

  return (
    `The ${gpu.name} (${gpu.vram_gb}GB ${gpu.memory_type}) is available from ${providerCount} cloud providers ` +
    `with current pricing starting at ${cheapest != null ? `$${cheapest.toFixed(2)}/hr` : "varies by provider"}. ` +
    trend
  );
}

export function generateGpuFaqs(gpu: GpuModel) {
  return [
    {
      q: `What is the typical ${gpu.short_name} cloud price per hour?`,
      a: `Pricing depends on provider, region, and availability. We track on-demand and spot pricing where available and show the latest observed range on this page.`,
    },
    {
      q: `Is spot pricing available for ${gpu.short_name}?`,
      a: `Some providers offer spot/preemptible pricing. Toggle spot pricing in the table to see spot rates when providers publish them.`,
    },
    {
      q: `How often is ${gpu.short_name} pricing updated?`,
      a: `We schedule provider-specific refresh jobs (staggered) and cache API responses to keep pages fast while maintaining data freshness.`,
    },
  ];
}
