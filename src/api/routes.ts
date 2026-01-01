import type { Express } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { healthHandler } from "./handlers/health.js";
import { listProvidersHandler, getProviderHandler } from "./handlers/providers.js";
import { listGpuModelsHandler, getGpuModelHandler } from "./handlers/gpu-models.js";
import { listInstancesHandler } from "./handlers/instances.js";
import { comparePricesHandler } from "./handlers/compare.js";
import { compareProvidersHandler } from "./handlers/compare-providers.js";
import { asyncHandler } from "./async.js";
import { cacheGetJson } from "./cache.js";
import { affiliateClickHandler } from "./handlers/affiliate.js";
import { affiliatePostbackHandler } from "./handlers/affiliate-postback.js";
import { cheapestStatsHandler } from "./handlers/stats.js";
import { providerReliabilityHandler } from "./handlers/reliability.js";
import { priceHistoryHandler } from "./handlers/price-history.js";
import { exportInstancesCsvHandler } from "./handlers/export.js";
import { exportCompareCsvHandler } from "./handlers/export-compare.js";
import {
  alertsConfirmHandler,
  alertsSubscribeHandler,
  alertsUnsubscribeHandler,
} from "./handlers/alerts.js";
import { createProviderReviewHandler, listProviderReviewsHandler } from "./handlers/reviews.js";
import { gpuStatsHandler } from "./handlers/gpu-stats.js";
import {
  registerHandler,
  loginHandler,
  magicLinkHandler,
  verifyEmailHandler,
  resendVerifyHandler,
  requestResetHandler,
  resetPasswordHandler,
  getMeHandler,
  updateMeHandler,
  saveComparisonHandler,
  listComparisonsHandler,
  deleteComparisonHandler,
  listAlertsHandler,
  claimAlertHandler,
  withAuth,
} from "./handlers/auth.js";
import { compose } from "./async.js";

export function registerApiRoutes(app: Express, deps: { pool: Pool; redis: Redis }) {
  app.get("/api/health", asyncHandler(healthHandler(deps)));

  app.get(
    "/api/providers",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "providers:list" }),
    asyncHandler(listProvidersHandler(deps.pool)),
  );
  app.get(
    "/api/providers/:slug",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "providers:get" }),
    asyncHandler(getProviderHandler(deps.pool)),
  );

  app.get(
    "/api/gpu-models",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 3600, keyPrefix: "gpus:list" }),
    asyncHandler(listGpuModelsHandler(deps.pool)),
  );
  app.get(
    "/api/gpu-models/:slug",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 3600, keyPrefix: "gpus:get" }),
    asyncHandler(getGpuModelHandler(deps.pool)),
  );
  app.get("/api/gpu-models/:slug/stats", asyncHandler(gpuStatsHandler(deps)));

  app.get(
    "/api/instances",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 60, keyPrefix: "instances:list" }),
    asyncHandler(listInstancesHandler(deps.pool)),
  );

  app.get(
    "/api/compare-prices",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 60, keyPrefix: "compare:gpu" }),
    asyncHandler(comparePricesHandler(deps.pool)),
  );

  app.get(
    "/api/compare-providers",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "compare:providers" }),
    asyncHandler(compareProvidersHandler(deps.pool)),
  );

  app.get(
    "/api/price-history",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "price-history" }),
    asyncHandler(priceHistoryHandler(deps.pool)),
  );

  app.get("/api/export/instances.csv", asyncHandler(exportInstancesCsvHandler(deps.pool)));
  app.get("/api/export/compare.csv", asyncHandler(exportCompareCsvHandler(deps.pool)));

  app.get(
    "/api/stats/cheapest",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 60, keyPrefix: "stats:cheapest" }),
    asyncHandler(cheapestStatsHandler(deps)),
  );

  app.get(
    "/api/providers/:slug/reliability",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "providers:reliability" }),
    asyncHandler(providerReliabilityHandler(deps.pool)),
  );

  app.get(
    "/api/providers/:slug/reviews",
    cacheGetJson({ redis: deps.redis, ttlSeconds: 300, keyPrefix: "providers:reviews" }),
    asyncHandler(listProviderReviewsHandler(deps.pool)),
  );
  app.post(
    "/api/providers/:slug/reviews",
    asyncHandler(createProviderReviewHandler({ pool: deps.pool, redis: deps.redis })),
  );

  app.post("/api/alerts/subscribe", asyncHandler(alertsSubscribeHandler(deps)));
  app.get("/api/alerts/confirm", asyncHandler(alertsConfirmHandler(deps.pool)));
  app.get("/api/alerts/unsubscribe", asyncHandler(alertsUnsubscribeHandler(deps.pool)));

  app.get("/api/affiliate/click", asyncHandler(affiliateClickHandler(deps.pool)));
  app.get("/api/affiliate/postback", asyncHandler(affiliatePostbackHandler(deps.pool)));

  // Authentication endpoints
  app.post("/api/auth/register", asyncHandler(registerHandler({ pool: deps.pool })));
  app.post("/api/auth/login", asyncHandler(loginHandler({ pool: deps.pool })));
  app.post("/api/auth/magic-link", asyncHandler(magicLinkHandler({ pool: deps.pool })));
  app.get("/api/auth/verify", asyncHandler(verifyEmailHandler({ pool: deps.pool })));
  app.post("/api/auth/resend-verify", asyncHandler(resendVerifyHandler({ pool: deps.pool })));
  app.post("/api/auth/request-reset", asyncHandler(requestResetHandler({ pool: deps.pool })));
  app.post("/api/auth/reset-password", asyncHandler(resetPasswordHandler({ pool: deps.pool })));

  // Protected user endpoints (require authentication)
  const withAuthMiddleware = withAuth({ pool: deps.pool });
  app.get("/api/me", compose(withAuthMiddleware, asyncHandler(getMeHandler({ pool: deps.pool }))));
  app.patch(
    "/api/me",
    compose(withAuthMiddleware, asyncHandler(updateMeHandler({ pool: deps.pool }))),
  );
  app.post(
    "/api/me/comparisons",
    compose(withAuthMiddleware, asyncHandler(saveComparisonHandler({ pool: deps.pool }))),
  );
  app.get(
    "/api/me/comparisons",
    compose(withAuthMiddleware, asyncHandler(listComparisonsHandler({ pool: deps.pool }))),
  );
  app.delete(
    "/api/me/comparisons/:id",
    compose(withAuthMiddleware, asyncHandler(deleteComparisonHandler({ pool: deps.pool }))),
  );
  app.get(
    "/api/me/alerts",
    compose(withAuthMiddleware, asyncHandler(listAlertsHandler({ pool: deps.pool }))),
  );
  app.post(
    "/api/me/alerts/:id/claim",
    compose(withAuthMiddleware, asyncHandler(claimAlertHandler({ pool: deps.pool }))),
  );
}
