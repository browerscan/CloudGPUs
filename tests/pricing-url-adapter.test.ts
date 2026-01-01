import { describe, expect, it } from "vitest";
import { PricingUrlHeuristicAdapter } from "../src/workers/adapters/pricing-url.js";
import type { AdapterContext } from "../src/workers/adapters/types.js";

describe("PricingUrlHeuristicAdapter", () => {
  it("extracts a price near a GPU mention", async () => {
    const adapter = new PricingUrlHeuristicAdapter("example-provider");

    const ctx: AdapterContext = {
      provider: {
        id: "p1",
        slug: "example-provider",
        pricingUrl: "https://example.com/pricing",
      },
      now: new Date("2025-12-31T00:00:00.000Z"),
      scrape: {
        fetchText: async () => ({ finalUrl: "https://example.com/pricing", status: 200, text: "" }),
        fetchJson: async <T>() => ({
          finalUrl: "https://example.com/pricing",
          status: 200,
          json: {} as unknown as T,
        }),
        browserHtml: async () => ({
          finalUrl: "https://example.com/pricing",
          html: `
            <html>
              <body>
                <h1>GPU pricing</h1>
                <div>H100 $2.50/hour 2x GPU</div>
              </body>
            </html>
          `,
        }),
      },
    };

    const out = await adapter.fetchPricing(ctx);
    expect(out.length).toBeGreaterThan(0);
    const h100 = out.find((r) => r.gpuSlug === "h100-sxm");
    expect(h100).toBeTruthy();
    expect(h100?.pricePerHour).toBe(2.5);
    expect(h100?.gpuCount).toBe(2);
    expect(h100?.sourceUrl).toBe("https://example.com/pricing");
  });
});
