import { describe, expect, it } from "vitest";

describe("Payload CMS config + seed data", () => {
  it("exports Payload config and collections", async () => {
    const cfgMod = await import("../../src/payload.config.js");
    expect(cfgMod.default).toBeDefined();

    const { Users } = await import("../../src/collections/users.js");
    const { Providers } = await import("../../src/collections/providers.js");
    const { GpuModels } = await import("../../src/collections/gpu-models.js");
    const { ProviderReviews } = await import("../../src/collections/provider-reviews.js");
    const { PriceAlertSubscriptions } =
      await import("../../src/collections/price-alert-subscriptions.js");

    expect(Users.slug).toBe("users");
    expect(Providers.slug).toBe("providers");
    expect(GpuModels.slug).toBe("gpu_models");
    expect(ProviderReviews.slug).toBe("provider_reviews");
    expect(PriceAlertSubscriptions.slug).toBe("price_alert_subscriptions");

    // Exercise a few access control functions for coverage.
    expect(Providers.access?.read?.({ req: { user: { id: "u1" } } } as never)).toBe(true);
    expect(Providers.access?.read?.({ req: { user: null } } as never)).toBe(false);

    expect(ProviderReviews.access?.update?.({ req: { user: { id: "u1" } } } as never)).toBe(true);
    expect(ProviderReviews.access?.update?.({ req: { user: null } } as never)).toBe(false);

    expect(GpuModels.access?.read?.({ req: { user: { id: "u1" } } } as never)).toBe(true);

    await expect(
      Users.access?.create?.({
        req: { user: { id: "u1" }, payload: { db: { findOne: async () => null } } },
      } as never),
    ).resolves.toBe(true);

    await expect(
      Users.access?.create?.({
        req: { user: null, payload: { db: { findOne: async () => null } } },
      } as never),
    ).resolves.toBe(true);

    await expect(
      Users.access?.create?.({
        req: { user: null, payload: { db: { findOne: async () => ({ id: "existing" }) } } },
      } as never),
    ).resolves.toBe(false);
  });

  it("includes baseline seed data for GPUs and providers", async () => {
    const { GPU_SEED, PROVIDER_SEED } = await import("../../src/db/seed-data.js");
    expect(GPU_SEED.length).toBeGreaterThanOrEqual(10);
    expect(PROVIDER_SEED.length).toBeGreaterThanOrEqual(20);
  });
});
