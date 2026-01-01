import "dotenv/config";
import { z } from "zod";

const DEFAULT_NODE_ENV =
  process.env["VITEST"] === "true" ? "test" : (process.env["NODE_ENV"] ?? "development");

const envSchema = z.object({
  NODE_ENV: z.string().default(DEFAULT_NODE_ENV),
  LOG_LEVEL: z.string().default("info"),
  PORT: z.coerce.number().default(3000),

  HEALTHCHECK_STRICT: z
    .enum(["true", "false"])
    .default(DEFAULT_NODE_ENV === "production" ? "true" : "false")
    .transform((v) => v === "true"),

  DATABASE_URI: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/postgres?schema=cloudgpus"),
  DB_POOL_MAX: z.coerce.number().optional(),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379/0"),

  PUBLIC_SITE_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  SCRAPER_MODE: z.enum(["hybrid", "live", "static"]).optional(),
  SOAX_PROXY_URL: z.string().optional(),

  // Authentication (falls back to PAYLOAD_SECRET for JWT signing)
  JWT_SECRET: z.string().optional(),

  // Optional integrations
  AFFILIATE_POSTBACK_SECRET: z.string().optional(),
  RATE_LIMIT_API_KEYS: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

export function resetEnvForTests() {
  cached = null;
}
