import { nanoid } from "nanoid";
import type { AdapterContext, PricingInstance, ProviderAdapter } from "./types.js";
import { allGpuPatterns } from "./gpu-slugs.js";

function stripHtml(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  return text.replace(/\s+/g, " ").trim();
}

const PRICE_RE = /\$?\s*([0-9]+(?:\.[0-9]{1,4})?)\s*(?:\/|per\s*)?(?:hr|hour|h)\b/i;
const COUNT_RE = /\b([1-8]|1[0-6])\s*(?:x|×)?\s*(?:gpu|gpus)\b/i;

export class PricingUrlHeuristicAdapter implements ProviderAdapter {
  constructor(public slug: string) {}

  async fetchPricing(ctx: AdapterContext): Promise<PricingInstance[]> {
    const pricingUrl = ctx.provider.pricingUrl;
    if (!pricingUrl) return [];

    const { html, finalUrl } = await ctx.scrape.browserHtml({
      url: pricingUrl,
      timeoutMs: 120_000,
      waitUntil: "domcontentloaded",
      blockResources: true,
    });

    const text = stripHtml(html);
    if (!text) return [];

    const patterns = allGpuPatterns();
    const found: PricingInstance[] = [];
    const seen = new Set<string>();

    for (const { slug: gpuSlug, re } of patterns) {
      const m = re.exec(text);
      if (!m) continue;

      const idx = m.index ?? 0;
      const start = Math.max(0, idx - 240);
      const end = Math.min(text.length, idx + 480);
      const window = text.slice(start, end);

      const priceMatch = PRICE_RE.exec(window);
      if (!priceMatch) continue;

      const price = Number(priceMatch[1]);
      if (!Number.isFinite(price) || price <= 0) continue;

      const countMatch = COUNT_RE.exec(window);
      const gpuCount = countMatch ? Number(countMatch[1]) : 1;

      const instanceType = `pricing:${gpuSlug}:${gpuCount}`;
      const key = `${gpuSlug}:${gpuCount}`;
      if (seen.has(key)) continue;
      seen.add(key);

      found.push({
        providerSlug: ctx.provider.slug,
        gpuSlug,
        instanceType,
        instanceName: `${gpuSlug.toUpperCase()} x${gpuCount}`,
        gpuCount,
        pricePerHour: price,
        currency: "USD",
        availabilityStatus: "available",
        sourceUrl: finalUrl,
        rawData: {
          type: "heuristic_pricing_url",
          extractedFrom: pricingUrl,
          window: window.slice(0, 400),
          requestId: nanoid(),
        },
      });
    }

    return found;
  }
}
