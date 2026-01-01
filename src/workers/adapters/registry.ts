import type { ProviderAdapter, ProviderContext } from "./types.js";
import { StaticAdapter } from "./static.js";
import { LambdaAdapter } from "./lambda.js";
import { PricingUrlHeuristicAdapter } from "./pricing-url.js";
import { EmptyAdapter } from "./empty.js";

const STATIC_FOR: ProviderAdapter = new StaticAdapter("static");

function staticForProvider(slug: string) {
  // Keep deterministic but per-provider.
  return slug === "static" ? STATIC_FOR : new StaticAdapter(slug);
}

export function getAdapter(provider: ProviderContext): ProviderAdapter {
  const mode = (process.env["SCRAPER_MODE"] ?? "hybrid").toLowerCase();
  if (mode === "static") return staticForProvider(provider.slug);

  // Prefer dedicated API adapters when keys exist.
  if (provider.slug === "lambda-labs") {
    return process.env["LAMBDA_API_KEY"]
      ? new LambdaAdapter(provider.slug)
      : provider.pricingUrl
        ? new PricingUrlHeuristicAdapter(provider.slug)
        : staticForProvider(provider.slug);
  }

  // Default: scrape provider pricing URL heuristically, then fall back to static/no-op.
  if (provider.pricingUrl) return new PricingUrlHeuristicAdapter(provider.slug);

  return mode === "live" ? new EmptyAdapter(provider.slug) : staticForProvider(provider.slug);
}
