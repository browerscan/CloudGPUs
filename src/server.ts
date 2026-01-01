import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { nanoid } from "nanoid";
import path from "node:path";
import { getEnv } from "./env.js";
import { logger } from "./logger.js";
import { createPool } from "./db/pool.js";
import { createRedis } from "./redis/client.js";
import { registerApiRoutes } from "./api/routes.js";
import { registerAdminRoutes } from "./admin/routes.js";
import type { Pool } from "pg";
import type { Redis } from "ioredis";

interface PinoRequest extends Omit<express.Request, "id"> {
  id?: string;
}

function requestIdFrom(req: express.Request, res: express.Response) {
  const fromHeader = res.getHeader("x-request-id");
  if (typeof fromHeader === "string" && fromHeader.length > 0) return fromHeader;
  const fromReq = req.headers["x-request-id"];
  if (typeof fromReq === "string" && fromReq.length > 0) return fromReq;
  // pino-http attaches req.id at runtime
  const pinoReq = req as PinoRequest;
  if (typeof pinoReq.id === "string" && pinoReq.id.length > 0) return pinoReq.id;
  return null;
}

export function createApp(deps?: { pool?: Pool; redis?: Redis }) {
  const app = express();
  const pool = deps?.pool ?? createPool();
  const redis = deps?.redis ?? createRedis();
  const env = getEnv();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req: express.Request, res: express.Response) => {
        const existing = req.headers["x-request-id"];
        if (typeof existing === "string" && existing.length > 0) return existing;
        const id = nanoid();
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Next.js / Payload (admin UI + CMS endpoints) need to read the raw request body.
  // Avoid consuming the stream via Express body parsers for those routes.
  const jsonParser = express.json({ limit: "2mb" });
  const urlencodedParser = express.urlencoded({ extended: true });
  app.use((req, res, nextMiddleware) => {
    if (
      req.path.startsWith("/admin") ||
      req.path.startsWith("/payload-api") ||
      req.path.startsWith("/_next")
    ) {
      nextMiddleware();
      return;
    }
    jsonParser(req, res, nextMiddleware);
  });
  app.use((req, res, nextMiddleware) => {
    if (
      req.path.startsWith("/admin") ||
      req.path.startsWith("/payload-api") ||
      req.path.startsWith("/_next")
    ) {
      nextMiddleware();
      return;
    }
    urlencodedParser(req, res, nextMiddleware);
  });

  app.use(
    cors({
      origin: (() => {
        const raw = env.CORS_ORIGINS;
        if (!raw) {
          // Fail-closed in production: if CORS_ORIGINS not set, deny all origins
          return env.NODE_ENV === "production" ? false : true;
        }
        const allow = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allow.includes(origin)) return cb(null, true);
          return cb(new Error("CORS not allowed"), false);
        };
      })(),
      credentials: true,
      exposedHeaders: ["x-request-id"],
    }),
  );

  // Rate limiting with API key validation
  // Parse valid API keys from env var (comma-separated)
  // Keys must be at least 16 chars to be considered valid
  const validApiKeys = new Set<string>(
    env.RATE_LIMIT_API_KEYS
      ? env.RATE_LIMIT_API_KEYS.split(",")
          .map((k) => k.trim())
          .filter((k) => k.length >= 16)
      : [],
  );

  // Log warning in production if no valid API keys are configured
  if (env.NODE_ENV === "production" && validApiKeys.size === 0 && env.RATE_LIMIT_API_KEYS) {
    logger.warn(
      { configuredKeys: env.RATE_LIMIT_API_KEYS.split(",").length },
      "RATE_LIMIT_API_KEYS is set but no valid keys (min 16 chars) were found",
    );
  }

  app.use(
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: (req) => {
        const apiKey = req.headers["x-api-key"];
        // High tier: only for explicitly validated API keys
        if (typeof apiKey === "string" && validApiKeys.has(apiKey)) {
          return 10_000;
        }
        // Standard tier: valid Authorization header (Bearer token)
        const auth = req.headers["authorization"];
        if (typeof auth === "string" && auth.startsWith("Bearer ")) {
          const token = auth.slice(7);
          if (token.length >= 16) return 1_000;
        }
        // Default tier: all other requests
        return 100;
      },
      skip: (req) =>
        req.path === "/api/health" ||
        req.path.startsWith("/admin") ||
        req.path.startsWith("/payload-api") ||
        req.path.startsWith("/_next"),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  registerAdminRoutes(app, { pool, redis });
  registerApiRoutes(app, { pool, redis });

  // PayloadCMS Admin UI (Next.js app in `cms/` directory)
  // Mounted on the API host (e.g. https://api.cloudgpus.io/admin).
  if (env.NODE_ENV !== "test") {
    const cmsDir = path.join(process.cwd(), "cms");

    let nextRuntime: Promise<{
      ready: Promise<void>;
      handler: (req: express.Request, res: express.Response) => unknown;
    }> | null = null;

    const loadNext = async () => {
      if (nextRuntime) return nextRuntime;
      nextRuntime = (async () => {
        const nextMod = await import("next");
        // Next's types can be finicky under NodeNext + ESM; runtime export is callable.
        const createNext = nextMod.default as unknown as (options: {
          dev: boolean;
          dir: string;
        }) => {
          getRequestHandler: () => (req: express.Request, res: express.Response) => unknown;
          prepare: () => Promise<void>;
        };

        const nextApp = createNext({ dev: env.NODE_ENV !== "production", dir: cmsDir });
        const handler = nextApp.getRequestHandler();

        // Prepare Next lazily to avoid blocking startup on cold boots.
        const ready = nextApp.prepare().catch((err: unknown) => {
          logger.error({ err }, "Failed to prepare Payload admin Next.js app");
          throw err;
        });

        return { ready, handler };
      })();

      return nextRuntime;
    };

    const handleNext = async (req: express.Request, res: express.Response) => {
      const { ready, handler } = await loadNext();
      await ready;
      return handler(req, res);
    };

    app.all("/_next/*", handleNext);
    app.all("/admin", handleNext);
    app.all("/admin/*", handleNext);
    app.all("/payload-api", handleNext);
    app.all("/payload-api/*", handleNext);
  }

  app.use((_req, res) => {
    const requestId = requestIdFrom(_req, res);
    res.status(404).json({
      status: 404,
      error: "not_found",
      message: "Route not found",
      requestId,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error({ err }, "Unhandled error");
      const requestId = requestIdFrom(_req, res);
      res.status(500).json({
        status: 500,
        error: "internal_error",
        message: "Internal server error",
        requestId,
        timestamp: new Date().toISOString(),
      });
    },
  );

  return app;
}

if (process.env["VITEST"] !== "true") {
  (async () => {
    const env = getEnv();

    // Run migrations on startup (skip if explicitly disabled)
    if (process.env["SKIP_MIGRATIONS"] !== "true") {
      try {
        const { runMigrationsOnStartup } = await import("./db/migrate.js");
        await runMigrationsOnStartup();
      } catch (err) {
        logger.error({ err }, "Failed to run migrations, continuing anyway...");
      }
    }

    const app = createApp();
    app.listen(env.PORT, "0.0.0.0", () => {
      logger.info({ port: env.PORT }, "API listening");
    });
  })().catch((err) => {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
}
