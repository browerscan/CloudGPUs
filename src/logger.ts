import pino from "pino";
import { getEnv } from "./env.js";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  redact: {
    paths: [
      // Common auth headers
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-api-key"]',
      'req.headers["x-affiliate-secret"]',
      // Query secrets/tokens (affiliate postbacks, email confirm/unsubscribe, etc.)
      "req.query.secret",
      "req.query.token",
    ],
    censor: "[redacted]",
  },
});
