import { afterEach, describe, expect, it } from "vitest";
import { getAdapter } from "../src/workers/adapters/registry.js";
import { StaticAdapter } from "../src/workers/adapters/static.js";
import { LambdaAdapter } from "../src/workers/adapters/lambda.js";
import { PricingUrlHeuristicAdapter } from "../src/workers/adapters/pricing-url.js";
import { EmptyAdapter } from "../src/workers/adapters/empty.js";

function setEnv(key: string, value: string | undefined) {
  if (value == null) delete process.env[key];
  else process.env[key] = value;
}

describe("adapter registry", () => {
  afterEach(() => {
    setEnv("SCRAPER_MODE", undefined);
    setEnv("LAMBDA_API_KEY", undefined);
  });

  it("returns StaticAdapter in static mode", () => {
    setEnv("SCRAPER_MODE", "static");
    const adapter = getAdapter({ id: "1", slug: "any", pricingUrl: "https://example.com" });
    expect(adapter).toBeInstanceOf(StaticAdapter);
  });

  it("returns EmptyAdapter in live mode with no pricing URL", () => {
    setEnv("SCRAPER_MODE", "live");
    const adapter = getAdapter({ id: "1", slug: "no-url", pricingUrl: null });
    expect(adapter).toBeInstanceOf(EmptyAdapter);
  });

  it("returns LambdaAdapter when LAMBDA_API_KEY is configured", () => {
    setEnv("SCRAPER_MODE", "hybrid");
    setEnv("LAMBDA_API_KEY", "x");
    const adapter = getAdapter({ id: "1", slug: "lambda-labs", pricingUrl: "https://example.com" });
    expect(adapter).toBeInstanceOf(LambdaAdapter);
  });

  it("returns PricingUrlHeuristicAdapter when pricing_url exists", () => {
    setEnv("SCRAPER_MODE", "hybrid");
    const adapter = getAdapter({
      id: "1",
      slug: "runpod",
      pricingUrl: "https://example.com/pricing",
    });
    expect(adapter).toBeInstanceOf(PricingUrlHeuristicAdapter);
  });
});
