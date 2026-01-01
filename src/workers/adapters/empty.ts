import type { AdapterContext, PricingInstance, ProviderAdapter } from "./types.js";

export class EmptyAdapter implements ProviderAdapter {
  constructor(public slug: string) {}

  async fetchPricing(_ctx: AdapterContext): Promise<PricingInstance[]> {
    return [];
  }
}
