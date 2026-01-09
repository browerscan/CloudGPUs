import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { pgSchema } from "drizzle-orm/pg-core";
import { Users } from "./collections/users.js";
import { Providers } from "./collections/providers.js";
import { GpuModels } from "./collections/gpu-models.js";
import { ProviderReviews } from "./collections/provider-reviews.js";
import { PriceAlertSubscriptions } from "./collections/price-alert-subscriptions.js";

const devSecret = "dev-secret-do-not-use-in-production-dev-secret-do-not-use-in-production";

const secret = process.env["PAYLOAD_SECRET"] ?? devSecret;
const isProduction = process.env["NODE_ENV"] === "production";
const lifecycle = process.env["npm_lifecycle_event"] ?? "";
const nextPhase = process.env["NEXT_PHASE"] ?? "";
const isBuildPhase =
  lifecycle.includes("build") ||
  nextPhase === "phase-production-build" ||
  nextPhase === "phase-production-export";

// Enforce a secure secret at runtime, but do not fail `next build cms` (build-time) where secrets
// may intentionally be injected only at deploy/runtime.
if (isProduction && !isBuildPhase) {
  if (!process.env["PAYLOAD_SECRET"] || process.env["PAYLOAD_SECRET"] === devSecret) {
    throw new Error(
      "PAYLOAD_SECRET must be set in production. Refusing to start without a secure secret.",
    );
  }
}

const databaseUri =
  process.env["DATABASE_URI"] ??
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=cloudgpus";

const serverURL = process.env["PAYLOAD_PUBLIC_SERVER_URL"] ?? "http://localhost:3000";

export default buildConfig({
  secret,
  serverURL,
  telemetry: false,
  admin: {
    user: "users",
  },
  routes: {
    admin: "/admin",
    api: "/payload-api",
  },
  db: postgresAdapter({
    pool: {
      connectionString: databaseUri,
    },
    idType: "uuid",
    schemaName: "cloudgpus",
    // Payload's Drizzle push will attempt to drop any enum types present in the schema but not in
    // the generated Payload schema. Because CloudGPUs maintains additional app tables (instances,
    // price history, etc.) in the same schema, we keep those enums in the schema snapshot so they
    // are never targeted for deletion.
    afterSchemaInit: [
      ({ schema }) => {
        const cloudgpus = pgSchema("cloudgpus");

        const availability_status = cloudgpus.enum("availability_status", [
          "available",
          "limited",
          "waitlist",
          "sold_out",
          "contact_sales",
          "deprecated",
        ]) as unknown as (typeof schema.enums)[string];

        const scrape_status = cloudgpus.enum("scrape_status", [
          "pending",
          "running",
          "completed",
          "failed",
          "timeout",
          "rate_limited",
        ]) as unknown as (typeof schema.enums)[string];

        const benchmark_workload = cloudgpus.enum("benchmark_workload", [
          "llm_training",
          "llm_inference",
          "image_generation",
          "video_generation",
          "fine_tuning",
          "embedding",
          "scientific_computing",
        ]) as unknown as (typeof schema.enums)[string];

        return {
          ...schema,
          enums: {
            ...schema.enums,
            availability_status: schema.enums["availability_status"] ?? availability_status,
            scrape_status: schema.enums["scrape_status"] ?? scrape_status,
            benchmark_workload: schema.enums["benchmark_workload"] ?? benchmark_workload,
          },
        };
      },
    ],
    // Limit Drizzle schema push to Payload-managed tables to avoid interactive rename prompts
    // (and accidental drops) when the application maintains additional tables in the same schema.
    tablesFilter: [
      "cms_*",
      "payload_*",
      // Payload collections backed by existing app tables
      "users",
      "providers",
      "gpu_models",
      "provider_reviews",
      "price_alert_subscriptions",
    ],
    push: true,
  }),
  collections: [Users, Providers, GpuModels, ProviderReviews, PriceAlertSubscriptions],
});
